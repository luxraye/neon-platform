import { createServiceRoleClient } from "@/utils/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email";

type NotificationType = "fee_reminder" | "quiz_result" | "announcement";

/**
 * In-app notification + optional email to signup address on profile.
 */
export async function notifyUser(
  userId: string,
  email: string | null | undefined,
  title: string,
  message: string,
  type: NotificationType
): Promise<void> {
  const admin = createServiceRoleClient();
  await admin.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
  });

  const addr = email?.trim();
  if (addr) {
    await sendTransactionalEmail({
      to: addr,
      subject: title,
      text: `${message}\n\n— Neon Student Management Platform`,
    });
  }
}

export async function notifyUsers(
  rows: { userId: string; email: string | null }[],
  title: string,
  message: string,
  type: NotificationType
): Promise<void> {
  const admin = createServiceRoleClient();
  const inserts = rows.map((r) => ({
    user_id: r.userId,
    title,
    message,
    type,
    is_read: false,
  }));
  if (inserts.length) {
    await admin.from("notifications").insert(inserts);
  }

  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e?.trim()));
  for (const addr of emails) {
    await sendTransactionalEmail({
      to: addr.trim(),
      subject: title,
      text: `${message}\n\n— Neon Student Management Platform`,
    });
  }
}

export async function getAdminProfiles(): Promise<{ id: string; email: string | null }[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("profiles").select("id, email").eq("role", "admin");
  if (error) {
    console.error("[notify] getAdminProfiles", error.message);
    return [];
  }
  return (data ?? []) as { id: string; email: string | null }[];
}

export async function getInstitutionStaff(
  institutionId: string,
  roles: ("tutor" | "headmaster")[]
): Promise<{ id: string; email: string | null }[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email")
    .eq("institution_id", institutionId)
    .in("role", roles)
    .is("deleted_at", null);
  if (error) {
    console.error("[notify] getInstitutionStaff", error.message);
    return [];
  }
  return (data ?? []) as { id: string; email: string | null }[];
}

export async function getStudentsForMaterialAudience(
  institutionId: string,
  cohortId: string | null
): Promise<{ id: string; email: string | null }[]> {
  const admin = createServiceRoleClient();
  let q = admin
    .from("profiles")
    .select("id, email")
    .eq("institution_id", institutionId)
    .eq("role", "student")
    .is("deleted_at", null);
  if (cohortId) {
    q = q.eq("cohort_id", cohortId);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[notify] getStudentsForMaterialAudience", error.message);
    return [];
  }
  return (data ?? []) as { id: string; email: string | null }[];
}

/** Headmasters for an institution (billing / deadline emails). */
export async function getHeadmastersForInstitution(
  institutionId: string
): Promise<{ id: string; email: string | null }[]> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email")
    .eq("institution_id", institutionId)
    .eq("role", "headmaster")
    .is("deleted_at", null);
  if (error) {
    console.error("[notify] getHeadmastersForInstitution", error.message);
    return [];
  }
  return (data ?? []) as { id: string; email: string | null }[];
}

/**
 * Avoid duplicate cron emails: insert dedupe row first; returns false if already sent.
 */
export async function tryClaimEmailDedupe(dedupeKey: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("email_dispatch_log").insert({ dedupe_key: dedupeKey });
  if (error) {
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      return false;
    }
    console.error("[notify] dedupe insert", error.message);
    return false;
  }
  return true;
}

export async function broadcastNewMaterialToStudents(
  institutionId: string,
  cohortId: string | null,
  title: string
): Promise<void> {
  const students = await getStudentsForMaterialAudience(institutionId, cohortId);
  if (!students.length) return;
  await notifyUsers(
    students.map((s) => ({ userId: s.id, email: s.email })),
    "New learning material",
    `New material: "${title}" — open Learn to view it.`,
    "announcement"
  );
}

export async function broadcastNewQuizToStudents(
  institutionId: string,
  cohortId: string | null,
  title: string,
  dueAt?: string | null
): Promise<void> {
  if (!cohortId) return;
  const students = await getStudentsForMaterialAudience(institutionId, cohortId);
  if (!students.length) return;
  const dueLine = dueAt ? ` Due: ${dueAt}.` : "";
  await notifyUsers(
    students.map((s) => ({ userId: s.id, email: s.email })),
    "New quiz available",
    `A new quiz "${title}" is published.${dueLine} Open Learn to take it when you are ready.`,
    "announcement"
  );
}

export async function notifyStaffUnassignedStudent(
  institutionId: string,
  studentName: string,
  studentEmail: string
): Promise<void> {
  const staff = await getInstitutionStaff(institutionId, ["tutor", "headmaster"]);
  if (!staff.length) return;
  await notifyUsers(
    staff.map((s) => ({ userId: s.id, email: s.email })),
    "Student needs cohort",
    `A new student (${studentName || studentEmail}) was added without a cohort. Assign them in Staff / cohorts.`,
    "announcement"
  );
}
