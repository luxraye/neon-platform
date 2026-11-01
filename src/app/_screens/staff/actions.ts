"use server";

/**
 * Staff provisioning: create the Firebase Auth account, then the `profiles` document with
 * the same id, so the headmaster's lists refresh straight away.
 */
import { getDb } from "@/lib/server/db";
import { getActor } from "@/lib/auth/identity";
import { createAuthUser, deleteAuthUser, passwordSetupLink, temporaryPassword } from "@/lib/server/auth-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { cohortBelongsTo } from "@/lib/server/guards";
import { notifyStaffUnassignedStudent } from "@/lib/notify-dispatch";

export type HireTutorResult =
  | { success: true; provisionedEmail: string }
  | { success: false; error: string };

export async function hireTutor(formData: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<HireTutorResult> {
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = getDb();
  if (identity.role !== "headmaster" || !identity.institution_id) {
    return { success: false, error: "Only headmasters can hire tutors." };
  }

  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  // Pass institution_id from headmaster so trigger and app both have it.
  const instId = identity.institution_id;
  const fullName = formData.full_name?.trim() ?? "";
  const { data: createData, error: createUserError } = await createAuthUser({
    email,
    password,
    fullName,
  });

  if (createUserError || !createData) {
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create tutor account.",
    };
  }

  const newUserId = createData.id;

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
    await deleteAuthUser(newUserId);
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
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = getDb();
  if (identity.role !== "headmaster" || !identity.institution_id) {
    return { success: false, error: "Only headmasters can provision students." };
  }

  const email = formData.email?.trim().toLowerCase();
  const password = formData.password;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const instId = identity.institution_id;
  const fullName = formData.full_name?.trim() ?? "";
  const cohortId = formData.cohort_id?.trim() || null;
  if (!(await cohortBelongsTo(cohortId, instId))) {
    return { success: false, error: "That cohort is not in your centre." };
  }

  const [{ data: inst }, { count: activeStudents }] = await Promise.all([
    admin.from("institutions").select("student_limit").eq("id", instId).maybeSingle(),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", instId)
      .eq("role", "student")
      .is("deleted_at", null),
  ]);
  const limit = Number(inst?.student_limit ?? 0);
  if (limit > 0 && (activeStudents ?? 0) >= limit) {
    return {
      success: false,
      error: `Your plan allows ${limit} students. Upgrade your plan or remove inactive students first.`,
    };
  }
  const { data: createData, error: createUserError } = await createAuthUser({
    email,
    password,
    fullName,
  });

  if (createUserError || !createData) {
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create student account.",
    };
  }

  const newUserId = createData.id;

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
    await deleteAuthUser(newUserId);
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
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = getDb();
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { success: false, error: "Only headmasters and tutors can assign students to cohorts." };
  }

  if (!cohortId || !(await cohortBelongsTo(cohortId, identity.institution_id))) {
    return { success: false, error: "That cohort is not in your centre." };
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
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };
  if (identity.role !== "headmaster" || !identity.institution_id)
    return { success: false, error: "Only headmasters can remove tutors." };

  const admin = getDb();
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
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };
  if (identity.role !== "headmaster" || !identity.institution_id)
    return { success: false, error: "Only headmasters can remove students." };

  const admin = getDb();
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
  // Kept for call-site compatibility; the caller's own centre is always used.
  _institutionId?: string | null,
  _provisionedEmails?: string[]
): Promise<StaffPayload> {
  void _institutionId;
  void _provisionedEmails;
  const identity = await getActor();
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

  const admin = getDb();
  const cutoffIso = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const activeOrRecoverable = `deleted_at.is.null,deleted_at.gte.${cutoffIso}`;

  const [tutorsRes, studentsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, role, deleted_at")
      .eq("institution_id", safeInstitutionId)
      .eq("role", "tutor")
      .or(activeOrRecoverable)
      .order("created_at", { ascending: false }),
    admin
      .from("profiles")
      .select("id, email, full_name, role, cohort_id, deleted_at")
      .eq("institution_id", safeInstitutionId)
      .eq("role", "student")
      .or(activeOrRecoverable)
      .order("created_at", { ascending: false }),
  ]);

  const tutorMap = new Map<string, StaffPayload["tutors"][number]>();
  for (const t of (tutorsRes.data ?? []) as StaffPayload["tutors"]) tutorMap.set(t.id, t);
  const studentMap = new Map<string, StaffPayload["students"][number]>();
  for (const st of (studentsRes.data ?? []) as StaffPayload["students"]) studentMap.set(st.id, st);

  return {
    tutors: Array.from(tutorMap.values()),
    students: Array.from(studentMap.values()),
  };
}

// ---- Join requests ---------------------------------------------------------

export type JoinRequestRow = {
  id: string;
  email: string;
  full_name: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export async function listJoinRequests(): Promise<JoinRequestRow[]> {
  const identity = await getActor(["headmaster"]);
  if (!identity?.institution_id) return [];
  const { data } = await getDb()
    .from("join_requests")
    .select("id, email, full_name, message, status, created_at")
    .eq("institution_id", identity.institution_id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as JoinRequestRow[];
}

export type ApproveJoinResult =
  | { success: true; email: string; setupLink: string | null; emailed: boolean }
  | { success: false; error: string };

/**
 * Approves a join request: creates the student's account with a random password and sends
 * (or returns) a one-time link for them to choose their own.
 */
export async function approveJoinRequest(requestId: string, cohortId?: string | null): Promise<ApproveJoinResult> {
  const identity = await getActor(["headmaster"]);
  if (!identity?.institution_id) return { success: false, error: "Only headmasters can approve requests." };
  const instId = identity.institution_id;
  const admin = getDb();

  const { data: req } = await admin.from("join_requests").select("*").eq("id", requestId).maybeSingle();
  if (!req || req.institution_id !== instId) return { success: false, error: "Request not found." };
  if (req.status !== "pending") return { success: false, error: "This request was already handled." };

  const cohort = cohortId?.trim() || null;
  if (!(await cohortBelongsTo(cohort, instId))) {
    return { success: false, error: "That cohort is not in your centre." };
  }

  const created = await provisionStudent({
    email: req.email,
    password: temporaryPassword(),
    full_name: req.full_name ?? undefined,
    cohort_id: cohort ?? undefined,
  });
  if (!created.success) return created;

  await admin
    .from("join_requests")
    .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: identity.user.id })
    .eq("id", requestId);

  const setupLink = await passwordSetupLink(req.email);
  let emailed = false;
  if (setupLink) {
    const res = await sendTransactionalEmail({
      to: req.email,
      subject: `You're in: ${identity.institution_name ?? "your centre"} on Neon`,
      text:
        `Hi ${req.full_name ?? ""},\n\nYour request to join ${identity.institution_name ?? "the centre"} was approved.\n` +
        `Choose your password here (the link works once):\n${setupLink}\n\n— Neon`,
    });
    emailed = res.ok;
  }

  return { success: true, email: req.email, setupLink, emailed };
}

export async function rejectJoinRequest(requestId: string): Promise<{ success: true } | { success: false; error: string }> {
  const identity = await getActor(["headmaster"]);
  if (!identity?.institution_id) return { success: false, error: "Only headmasters can reject requests." };
  const { error } = await getDb()
    .from("join_requests")
    .update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: identity.user.id })
    .eq("id", requestId)
    .eq("institution_id", identity.institution_id)
    .eq("status", "pending");
  if (error) return { success: false, error: error.message };
  return { success: true };
}
