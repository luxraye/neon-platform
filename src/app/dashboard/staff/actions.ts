"use server";

/**
 * Staff provisioning: always `auth.admin.createUser` then immediate `profiles` upsert by ID
 * (no reliance on DB triggers) so headmaster staff lists refresh consistently.
 */
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";
import { notifyStaffUnassignedStudent } from "@/lib/notify-dispatch";

export type HireTutorResult =
  | { success: true; provisionedEmail: string }
  | { success: false; error: string };

export async function hireTutor(formData: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<HireTutorResult> {
  const identity = await getUserIdentity();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  if (identity.role !== "headmaster" || !identity.institution_id) {
    return { success: false, error: "Only headmasters can hire tutors." };
  }

  const email = formData.email?.trim();
  const password = formData.password;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  // Pass institution_id from headmaster so trigger and app both have it.
  const instId = identity.institution_id;
  const fullName = formData.full_name?.trim() ?? "";
  const { data: createData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      institution_id: instId,
      role: "tutor",
      full_name: fullName,
    },
  });

  if (createUserError) {
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create tutor account.",
    };
  }

  const newUserId = createData?.user?.id;
  if (!newUserId) {
    return { success: false, error: "Auth user was not returned after creation." };
  }

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: newUserId,
      institution_id: instId,
      email,
      role: "tutor",
      full_name: fullName || null,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return { success: false, error: `Failed to link tutor profile: ${upsertError.message}` };
  }

  const { data: verifyRow, error: verifyErr } = await admin
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", newUserId)
    .maybeSingle();

  if (verifyErr || !verifyRow || verifyRow.role !== "tutor" || verifyRow.institution_id !== instId) {
    return {
      success: false,
      error: verifyErr?.message ?? "Profile row missing or inconsistent after upsert.",
    };
  }

  return { success: true, provisionedEmail: email };
}

export type AssignCohortResult =
  | { success: true }
  | { success: false; error: string };

export type ProvisionStudentResult =
  | { success: true; provisionedEmail: string }
  | { success: false; error: string };

export async function provisionStudent(formData: {
  email: string;
  password: string;
  full_name?: string;
  cohort_id?: string;
}): Promise<ProvisionStudentResult> {
  const identity = await getUserIdentity();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  if (identity.role !== "headmaster" || !identity.institution_id) {
    return { success: false, error: "Only headmasters can provision students." };
  }

  const email = formData.email?.trim();
  const password = formData.password;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const instId = identity.institution_id;
  const fullName = formData.full_name?.trim() ?? "";
  const cohortId = formData.cohort_id?.trim() ?? null;
  const { data: createData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      institution_id: instId,
      role: "student",
      full_name: fullName,
    },
  });

  if (createUserError) {
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create student account.",
    };
  }

  const newUserId = createData?.user?.id;
  if (!newUserId) {
    return { success: false, error: "Auth user was not returned after creation." };
  }

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: newUserId,
      institution_id: instId,
      email,
      role: "student",
      full_name: fullName || null,
      cohort_id: cohortId,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return { success: false, error: `Failed to link student profile: ${upsertError.message}` };
  }

  const { data: verifyRow, error: verifyErr } = await admin
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", newUserId)
    .maybeSingle();

  if (verifyErr || !verifyRow || verifyRow.role !== "student" || verifyRow.institution_id !== instId) {
    return {
      success: false,
      error: verifyErr?.message ?? "Profile row missing or inconsistent after upsert.",
    };
  }

  if (!cohortId) {
    try {
      await notifyStaffUnassignedStudent(instId, fullName, email);
    } catch (e) {
      console.error("[provisionStudent] notify staff", e);
    }
  }

  return { success: true, provisionedEmail: email };
}

export async function assignStudentToCohort(
  studentId: string,
  cohortId: string
): Promise<AssignCohortResult> {
  const identity = await getUserIdentity();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { success: false, error: "Only headmasters and tutors can assign students to cohorts." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ cohort_id: cohortId })
    .eq("id", studentId)
    .eq("institution_id", identity.institution_id)
    .eq("role", "student");

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export type RemoveStaffResult = { success: true } | { success: false; error: string };

/** Headmaster marks a tutor as removed. Recoverable by admin within 72 hours. */
export async function removeTutor(profileId: string): Promise<RemoveStaffResult> {
  const identity = await getUserIdentity();
  if (!identity) return { success: false, error: "Not authenticated." };
  if (identity.role !== "headmaster" || !identity.institution_id)
    return { success: false, error: "Only headmasters can remove tutors." };

  const admin = createServiceRoleClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, institution_id, role, deleted_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!target || target.institution_id !== identity.institution_id || target.role !== "tutor")
    return { success: false, error: "Tutor not found in your institution." };
  if (target.deleted_at) return { success: false, error: "Already marked for removal." };

  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), deleted_by: identity.user.id })
    .eq("id", profileId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Headmaster marks a student as removed. Recoverable by admin within 72 hours. */
export async function removeStudent(profileId: string): Promise<RemoveStaffResult> {
  const identity = await getUserIdentity();
  if (!identity) return { success: false, error: "Not authenticated." };
  if (identity.role !== "headmaster" || !identity.institution_id)
    return { success: false, error: "Only headmasters can remove students." };

  const admin = createServiceRoleClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, institution_id, role, deleted_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!target || target.institution_id !== identity.institution_id || target.role !== "student")
    return { success: false, error: "Student not found in your institution." };
  if (target.deleted_at) return { success: false, error: "Already marked for removal." };

  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), deleted_by: identity.user.id })
    .eq("id", profileId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type StaffPayload = {
  tutors: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    deleted_at: string | null;
  }[];
  students: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    cohort_id: string | null;
    deleted_at: string | null;
  }[];
};

/** Returns tutors and students for the current user's institution. Use when caller is headmaster so RLS doesn't hide peers. */
export async function getStaff(
  _institutionId: string,
  provisionedEmails: string[] = []
): Promise<StaffPayload> {
  const identity = await getUserIdentity();
  if (!identity) return { tutors: [], students: [] };
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { tutors: [], students: [] };
  }

  // Security: always use the caller's own institution_id.
  const safeInstitutionId = identity.institution_id;
  if (!safeInstitutionId) return { tutors: [], students: [] };

  const admin = createServiceRoleClient();
  const emails = (provisionedEmails ?? []).filter(Boolean);
  const cutoffIso = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const activeOrRecoverable = `deleted_at.is.null,deleted_at.gte.${cutoffIso}`;

  const [tutorsByInstitution, tutorsByEmail, studentsByInstitution, studentsByEmail] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, role, deleted_at")
      .eq("institution_id", safeInstitutionId)
      .eq("role", "tutor")
      .or(activeOrRecoverable)
      .order("created_at", { ascending: false }),
    emails.length
      ? admin
          .from("profiles")
          .select("id, email, full_name, role, deleted_at")
          .in("email", emails)
          .eq("role", "tutor")
          .or(`institution_id.eq.${safeInstitutionId},institution_id.is.null`)
          .or(activeOrRecoverable)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("profiles")
      .select("id, email, full_name, role, cohort_id, deleted_at")
      .eq("institution_id", safeInstitutionId)
      .eq("role", "student")
      .or(activeOrRecoverable)
      .order("created_at", { ascending: false }),
    emails.length
      ? admin
          .from("profiles")
          .select("id, email, full_name, role, cohort_id, deleted_at")
          .in("email", emails)
          .eq("role", "student")
          .or(`institution_id.eq.${safeInstitutionId},institution_id.is.null`)
          .or(activeOrRecoverable)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const tutorMap = new Map<string, StaffPayload["tutors"][number]>();
  for (const t of ((tutorsByInstitution.data ?? []) as StaffPayload["tutors"])) tutorMap.set(t.id, t);
  for (const t of ((tutorsByEmail.data ?? []) as StaffPayload["tutors"])) tutorMap.set(t.id, t);

  const studentMap = new Map<string, StaffPayload["students"][number]>();
  for (const s of ((studentsByInstitution.data ?? []) as StaffPayload["students"])) studentMap.set(s.id, s);
  for (const s of ((studentsByEmail.data ?? []) as StaffPayload["students"])) studentMap.set(s.id, s);

  return {
    tutors: Array.from(tutorMap.values()),
    students: Array.from(studentMap.values()),
  };
}
