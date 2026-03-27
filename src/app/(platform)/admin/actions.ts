"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { calculateTieredMonthlyDue, getCurrentReportMonth } from "@/lib/billing";

export type ProvisionResult =
  | { success: true; institutionId: string; tempPassword: string }
  | { success: false; error: string };

export async function provisionInstitution(formData: {
  name: string;
  subdomain: string;
  subscription_tier: "starter" | "growth" | "elite";
  headmaster_email: string;
  headmaster_password?: string;
  headmaster_full_name?: string;
  lead_id?: string;
}): Promise<ProvisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  // Use service role for role verification to avoid RLS blocking the check.
  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? (user.user_metadata?.role as string | undefined);
  if (role !== "admin") {
    return { success: false, error: "Only admins can provision institutions." };
  }

  const { name, subdomain, subscription_tier, headmaster_email, headmaster_password, headmaster_full_name, lead_id } =
    formData;

  if (!name?.trim() || !subdomain?.trim() || !headmaster_email?.trim()) {
    return { success: false, error: "Name, subdomain, and headmaster email are required." };
  }

  const tempPassword =
    headmaster_password?.trim() ||
    `Neon@${Math.random().toString(36).slice(2, 6)}${Math.random().toString(36).slice(2, 6)}`;

  // 1. Create the institution first (no automatic trial).
  const { data: institution, error: instError } = await admin
    .from("institutions")
    .insert({
      name: name.trim(),
      subdomain: subdomain.trim().toLowerCase(),
      subscription_tier: subscription_tier || "starter",
      is_trial: false,
      trial_ends_at: null,
    })
    .select("id")
    .single();

  if (instError || !institution) {
    return {
      success: false,
      error: instError?.message ?? "Failed to create institution.",
    };
  }

  // 2. Create headmaster Auth user; pass institution_id, role, full_name in user_metadata so
  //    handle_new_user trigger can create the profile row automatically.
  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email: headmaster_email.trim(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      institution_id: institution.id,
      role: "headmaster",
      full_name: headmaster_full_name?.trim() ?? "",
    },
  });

  if (createUserError || !newUser.user) {
    await admin.from("institutions").delete().eq("id", institution.id);
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create headmaster account.",
    };
  }

  // Profile is created by DB trigger (handle_new_user) from user_metadata.
  // If trigger is missing/misconfigured, self-heal by ensuring a profile exists and is linked.
  const headmasterId = newUser.user.id;
  const { data: createdProfile } = await admin
    .from("profiles")
    .select("id, institution_id, role")
    .eq("id", headmasterId)
    .maybeSingle();

  if (!createdProfile || createdProfile.institution_id !== institution.id || createdProfile.role !== "headmaster") {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: headmasterId,
        institution_id: institution.id,
        email: headmaster_email.trim(),
        role: "headmaster",
        full_name: headmaster_full_name?.trim() || null,
      },
      { onConflict: "id" }
    );
    if (upsertError) {
      // Rollback so we don't leave a broken institution in the system.
      await admin.auth.admin.deleteUser(headmasterId);
      await admin.from("institutions").delete().eq("id", institution.id);
      return {
        success: false,
        error:
          upsertError.message ??
          "Provisioned institution but failed to create headmaster profile. Check handle_new_user trigger and profiles RLS.",
      };
    }
  }

  if (lead_id) {
    await admin.from("leads").update({ status: "converted" }).eq("id", lead_id);
  }

  return { success: true, institutionId: institution.id, tempPassword };
}

export type DeleteLeadResult = { success: true } | { success: false; error: string };

export async function deleteLead(leadId: string): Promise<DeleteLeadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can delete leads." };

  const { error } = await admin.from("leads").delete().eq("id", leadId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type GenerateReportResult =
  | { success: true }
  | { success: false; error: string };

export async function generateMonthlyReport(): Promise<GenerateReportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? (user.user_metadata?.role as string | undefined);
  if (role !== "admin") {
    return { success: false, error: "Only admins can generate reports." };
  }

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, subscription_tier");

  if (!institutions?.length) {
    return { success: true };
  }

  const reportMonth = getCurrentReportMonth();

  for (const inst of institutions) {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", inst.id)
      .eq("role", "student");

    const studentCount = count ?? 0;
    const totalRevenueDue = calculateTieredMonthlyDue(studentCount, inst.subscription_tier);

    const { error: upsertError } = await admin.from("financial_reports").upsert({
      institution_id: inst.id,
      report_month: reportMonth,
      student_count: studentCount,
      total_revenue_due: totalRevenueDue,
      status: "pending",
    }, { onConflict: "institution_id,report_month" });
    if (upsertError) {
      return { success: false, error: upsertError.message };
    }

    const { error: invoiceUpsertError } = await admin.from("platform_invoices").upsert(
      {
        institution_id: inst.id,
        report_month: reportMonth,
        amount_due: totalRevenueDue,
        status: "pending",
      },
      { onConflict: "institution_id,report_month" }
    );
    if (invoiceUpsertError && !/does not exist|relation .* does not exist/i.test(invoiceUpsertError.message)) {
      return { success: false, error: invoiceUpsertError.message };
    }
  }

  return { success: true };
}

export type ExtendTrialResult = { success: true } | { success: false; error: string };
export async function extendTrial(institutionId: string): Promise<ExtendTrialResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can extend trial." };
  const { data: inst } = await admin
    .from("institutions")
    .select("trial_ends_at")
    .eq("id", institutionId)
    .single();
  if (!inst) return { success: false, error: "Institution not found." };
  const base = inst.trial_ends_at ? new Date(inst.trial_ends_at) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + 7);
  const { error } = await admin
    .from("institutions")
    .update({ trial_ends_at: next.toISOString().slice(0, 10), is_trial: true })
    .eq("id", institutionId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type SetTierResult = { success: true } | { success: false; error: string };
export async function setInstitutionTier(
  institutionId: string,
  subscription_tier: "starter" | "growth" | "elite"
): Promise<SetTierResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can change tier." };
  const { error } = await admin
    .from("institutions")
    .update({ subscription_tier })
    .eq("id", institutionId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type DeleteInstitutionResult = { success: true } | { success: false; error: string };

/** Delete an institution and all dependent data. Unlinks profiles (sets institution_id = null). */
export async function deleteInstitution(institutionId: string): Promise<DeleteInstitutionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can delete institutions." };

  // Clear dependent tables (skip if a table doesn't exist in this deployment)
  const tablesWithInstitutionId = [
    "timetables",
    "attendance",
    "cash_payments",
    "financial_reports",
    "platform_payment_transactions",
    "platform_invoices",
    "user_feedback",
  ] as const;

  const isTableMissing = (msg: string) =>
    /could not find the table|does not exist|relation .* does not exist/i.test(msg);

  for (const table of tablesWithInstitutionId) {
    const { error } = await admin.from(table).delete().eq("institution_id", institutionId);
    if (error && !isTableMissing(error.message)) {
      return { success: false, error: `Failed to clear ${table}: ${error.message}` };
    }
  }

  const { data: cohortRows } = await admin.from("cohorts").select("id").eq("institution_id", institutionId);
  const cohortIds = (cohortRows ?? []).map((c) => c.id);

  const { error: quizErr } = await admin.from("quizzes").delete().eq("institution_id", institutionId);
  if (quizErr && !isTableMissing(quizErr.message)) {
    return { success: false, error: `Failed to clear quizzes: ${quizErr.message}` };
  }

  if (cohortIds.length > 0) {
    const { error: matErr } = await admin.from("materials").delete().in("cohort_id", cohortIds);
    if (matErr && !isTableMissing(matErr.message)) {
      return { success: false, error: `Failed to clear materials: ${matErr.message}` };
    }
  }

  const { error: cohortErr } = await admin.from("cohorts").delete().eq("institution_id", institutionId);
  if (cohortErr) return { success: false, error: `Failed to delete cohorts: ${cohortErr.message}` };

  try {
    const { data: postIds } = await admin.from("forum_posts").select("id").eq("institution_id", institutionId);
    const postIdList = (postIds ?? []).map((p) => p.id);
    if (postIdList.length > 0) {
      await admin.from("forum_comments").delete().in("post_id", postIdList);
    }
    await admin.from("forum_posts").delete().eq("institution_id", institutionId);
  } catch {
    // Forum tables may not exist in all deployments
  }

  await admin.from("profiles").update({ institution_id: null }).eq("institution_id", institutionId);

  const { error: instErr } = await admin.from("institutions").delete().eq("id", institutionId);
  if (instErr) return { success: false, error: `Failed to delete institution: ${instErr.message}` };
  return { success: true };
}

const RECOVERY_HOURS = 72;

export type PendingDeletionRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  institution_id: string | null;
  deleted_at: string;
  deleted_by: string | null;
};

/** Admin: list profiles marked for removal (recoverable within 72h). */
export async function getPendingDeletions(): Promise<PendingDeletionRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return [];
  const cutoffIso = new Date(Date.now() - RECOVERY_HOURS * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, role, institution_id, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoffIso)
    .order("deleted_at", { ascending: false });

  return (data ?? []) as PendingDeletionRow[];
}

export type RestoreProfileResult = { success: true } | { success: false; error: string };

/** Admin: restore a profile within 72 hours of removal. */
export async function restoreProfile(profileId: string): Promise<RestoreProfileResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can restore profiles." };

  const { data: target } = await admin
    .from("profiles")
    .select("deleted_at")
    .eq("id", profileId)
    .single();

  if (!target?.deleted_at) return { success: false, error: "Profile is not pending deletion." };

  const deletedAt = new Date(target.deleted_at);
  const cutoff = new Date(Date.now() - RECOVERY_HOURS * 60 * 60 * 1000);
  if (deletedAt < cutoff) {
    return { success: false, error: "Recovery window (72 hours) has expired. Account can no longer be restored." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", profileId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type UpdateFeedbackStatusResult = { success: true } | { success: false; error: string };

export async function updateFeedbackStatus(formData: {
  feedbackId: string;
  status: "new" | "reviewing" | "planned" | "resolved" | "dismissed";
  adminNotes?: string;
}): Promise<UpdateFeedbackStatusResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { success: false, error: "Only admins can update feedback." };

  const { feedbackId, status, adminNotes } = formData;
  if (!feedbackId) return { success: false, error: "Feedback id is required." };
  const notes = adminNotes?.trim() || null;
  const { error } = await admin
    .from("user_feedback")
    .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
    .eq("id", feedbackId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

