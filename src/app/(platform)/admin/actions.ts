"use server";

import { getActor } from "@/lib/auth/identity";
import { createAuthUser, deleteAuthUser, temporaryPassword } from "@/lib/server/auth-admin";
import { getDb } from "@/lib/server/db";
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
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can provision institutions." };
  const admin = getDb();

  const { name, subdomain, subscription_tier, headmaster_email, headmaster_password, headmaster_full_name, lead_id } =
    formData;

  if (!name?.trim() || !subdomain?.trim() || !headmaster_email?.trim()) {
    return { success: false, error: "Name, subdomain, and headmaster email are required." };
  }

  const tempPassword = headmaster_password?.trim() || temporaryPassword();
  const subdomainClean = subdomain.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(subdomainClean)) {
    return { success: false, error: "Short name must be 3-40 lowercase letters, numbers or dashes." };
  }
  const { data: taken } = await admin.from("institutions").select("id").eq("subdomain", subdomainClean).maybeSingle();
  if (taken) return { success: false, error: "That short name is already used by another centre." };

  // 1. Create the institution first (no automatic trial).
  const { data: institution, error: instError } = await admin
    .from("institutions")
    .insert({
      name: name.trim(),
      subdomain: subdomainClean,
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

  // 2. Create the headmaster's sign-in account and profile.
  const { data: newUser, error: createUserError } = await createAuthUser({
    email: headmaster_email,
    password: tempPassword,
    fullName: headmaster_full_name,
  });

  if (createUserError || !newUser) {
    await admin.from("institutions").delete().eq("id", institution.id);
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create headmaster account.",
    };
  }

  const headmasterId = newUser.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: headmasterId,
    institution_id: institution.id,
    email: headmaster_email.trim().toLowerCase(),
    role: "headmaster",
    full_name: headmaster_full_name?.trim() || null,
  });
  if (profileError) {
    // Roll back so we don't leave a broken institution in the system.
    await deleteAuthUser(headmasterId);
    await admin.from("institutions").delete().eq("id", institution.id);
    return { success: false, error: profileError.message };
  }

  if (lead_id) {
    await admin.from("leads").update({ status: "converted" }).eq("id", lead_id);
  }

  return { success: true, institutionId: institution.id, tempPassword };
}

export type DeleteLeadResult = { success: true } | { success: false; error: string };

export async function deleteLead(leadId: string): Promise<DeleteLeadResult> {
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can delete leads." };

  const { error } = await getDb().from("leads").delete().eq("id", leadId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type GenerateReportResult =
  | { success: true }
  | { success: false; error: string };

export async function generateMonthlyReport(): Promise<GenerateReportResult> {
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can generate reports." };
  const admin = getDb();

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
      .eq("role", "student")
      .is("deleted_at", null);

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
    if (invoiceUpsertError) {
      return { success: false, error: invoiceUpsertError.message };
    }
  }

  return { success: true };
}

export type ExtendTrialResult = { success: true } | { success: false; error: string };
export async function extendTrial(institutionId: string): Promise<ExtendTrialResult> {
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can extend trial." };
  const admin = getDb();
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
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can change tier." };
  const admin = getDb();
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
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can delete institutions." };
  const admin = getDb();

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

  for (const table of tablesWithInstitutionId) {
    const { error } = await admin.from(table).delete().eq("institution_id", institutionId);
    if (error) {
      return { success: false, error: `Failed to clear ${table}: ${error.message}` };
    }
  }

  const { data: quizRows } = await admin.from("quizzes").select("id").eq("institution_id", institutionId);
  const quizIds = (quizRows ?? []).map((q: { id: string }) => q.id);
  if (quizIds.length > 0) {
    await admin.from("quiz_attempts").delete().in("quiz_id", quizIds);
  }

  const { error: quizErr } = await admin.from("quizzes").delete().eq("institution_id", institutionId);
  if (quizErr) return { success: false, error: `Failed to clear quizzes: ${quizErr.message}` };

  const { error: matErr } = await admin.from("materials").delete().eq("institution_id", institutionId);
  if (matErr) return { success: false, error: `Failed to clear materials: ${matErr.message}` };

  await admin.from("join_requests").delete().eq("institution_id", institutionId);

  const { error: cohortErr } = await admin.from("cohorts").delete().eq("institution_id", institutionId);
  if (cohortErr) return { success: false, error: `Failed to delete cohorts: ${cohortErr.message}` };

  const { data: postIds } = await admin.from("forum_posts").select("id").eq("institution_id", institutionId);
  const postIdList = (postIds ?? []).map((p: { id: string }) => p.id);
  if (postIdList.length > 0) {
    await admin.from("forum_comments").delete().in("post_id", postIdList);
  }
  await admin.from("forum_posts").delete().eq("institution_id", institutionId);

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
  const actor = await getActor(["admin"]);
  if (!actor) return [];
  const admin = getDb();
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
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can restore profiles." };
  const admin = getDb();

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
  const actor = await getActor(["admin"]);
  if (!actor) return { success: false, error: "Only admins can update feedback." };
  const admin = getDb();

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

