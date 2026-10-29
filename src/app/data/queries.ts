"use server";

/**
 * Read-only data loaders for client components.
 *
 * Browsers never talk to Firestore directly. Every loader here resolves the signed-in user
 * on the server and scopes the query to their centre (and, for students, to themselves or
 * their cohort). Ids passed in from the browser are always re-checked.
 */

import { getActor, type Actor } from "@/lib/auth/identity";
import { getDb } from "@/lib/server/db";
import { cohortBelongsTo, profileBelongsTo } from "@/lib/server/guards";

const STAFF = ["headmaster", "tutor"] as const;
const RECOVERY_MS = 72 * 60 * 60 * 1000;

function isStaff(actor: Actor) {
  return actor.role === "headmaster" || actor.role === "tutor";
}

// ---- Me ---------------------------------------------------------------------

export type MeProfile = {
  id: string;
  institution_id: string | null;
  email: string;
  role: "admin" | "headmaster" | "tutor" | "student";
  full_name: string | null;
  cohort_id: string | null;
  avatar_url: string | null;
};

export type MeInstitution = {
  id: string;
  name: string;
  subdomain: string;
  subscription_tier: "starter" | "growth" | "elite";
  branding_config: unknown;
  student_limit: number;
  is_trial: boolean;
  trial_ends_at: string | null;
  primary_color: string | null;
  logo_url: string | null;
};

export type MeResult = {
  user: { id: string; email: string | null } | null;
  profile: MeProfile | null;
  institution: MeInstitution | null;
};

export async function qMe(): Promise<MeResult> {
  const actor = await getActor();
  if (!actor) return { user: null, profile: null, institution: null };
  const p = actor.profile!;
  const profile: MeProfile = {
    id: p.id,
    institution_id: p.institution_id,
    email: p.email ?? actor.user.email ?? "",
    role: actor.role,
    full_name: p.full_name,
    cohort_id: p.cohort_id,
    avatar_url: p.avatar_url ?? null,
  };
  let institution: MeInstitution | null = null;
  if (actor.institution_id) {
    const { data } = await getDb()
      .from("institutions")
      .select(
        "id, name, subdomain, subscription_tier, branding_config, student_limit, is_trial, trial_ends_at, primary_color, logo_url"
      )
      .eq("id", actor.institution_id)
      .maybeSingle<MeInstitution>();
    institution = data;
  }
  return { user: actor.user, profile, institution };
}

// ---- Cohorts ------------------------------------------------------------------

export type CohortDto = {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export async function qCohorts(): Promise<CohortDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  let q = getDb()
    .from("cohorts")
    .select("id, institution_id, name, description, created_at")
    .eq("institution_id", actor.institution_id);
  if (actor.role === "student") {
    if (!actor.profile?.cohort_id) return [];
    q = q.eq("id", actor.profile.cohort_id);
  }
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as CohortDto[];
}

export async function qCohortName(cohortId: string): Promise<string | null> {
  const actor = await getActor();
  if (!actor?.institution_id || !cohortId) return null;
  const { data } = await getDb().from("cohorts").select("name, institution_id").eq("id", cohortId).maybeSingle();
  return data && data.institution_id === actor.institution_id ? (data.name as string) : null;
}

export type CohortStudentDto = { id: string; email: string; full_name: string | null; cohort_id: string | null };

export async function qCohortStudents(cohortId: string): Promise<CohortStudentDto[]> {
  const actor = await getActor([...STAFF]);
  if (!actor?.institution_id || !(await cohortBelongsTo(cohortId, actor.institution_id))) return [];
  const { data } = await getDb()
    .from("profiles")
    .select("id, email, full_name, cohort_id")
    .eq("institution_id", actor.institution_id)
    .eq("role", "student")
    .eq("cohort_id", cohortId)
    .is("deleted_at", null)
    .order("full_name");
  return (data ?? []) as CohortStudentDto[];
}

// ---- Attendance ------------------------------------------------------------------

export type AttendanceDto = {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent" | "late";
  remarks: string | null;
};

export async function qAttendance(cohortId: string, date: string): Promise<AttendanceDto[]> {
  const actor = await getActor([...STAFF]);
  if (!actor?.institution_id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const { data } = await getDb()
    .from("attendance")
    .select("id, student_id, date, status, remarks")
    .eq("institution_id", actor.institution_id)
    .eq("cohort_id", cohortId)
    .eq("date", date);
  return (data ?? []) as AttendanceDto[];
}

// ---- Timetable ------------------------------------------------------------------

export type TimetableDto = {
  id: string;
  institution_id: string;
  cohort_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  tutor_id: string | null;
  room: string | null;
  created_at: string;
};

export async function qTimetable(cohortId: string | null): Promise<TimetableDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  let effectiveCohort = cohortId;
  if (actor.role === "student") {
    effectiveCohort = actor.profile?.cohort_id ?? null;
    if (!effectiveCohort) return [];
  }
  let q = getDb()
    .from("timetables")
    .select("id, institution_id, cohort_id, day_of_week, start_time, end_time, subject, tutor_id, room, created_at")
    .eq("institution_id", actor.institution_id);
  if (effectiveCohort) q = q.eq("cohort_id", effectiveCohort);
  const { data } = await q.order("start_time");
  return (data ?? []) as TimetableDto[];
}

/** Names of the centre's staff, for labelling timetable slots. */
export async function qStaffNames(): Promise<Record<string, string>> {
  const actor = await getActor();
  if (!actor?.institution_id) return {};
  const { data } = await getDb()
    .from("profiles")
    .select("id, full_name, email")
    .eq("institution_id", actor.institution_id)
    .in("role", ["tutor", "headmaster"]);
  const map: Record<string, string> = {};
  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    map[p.id] = p.full_name || p.email || "Staff";
  }
  return map;
}

// ---- Community ------------------------------------------------------------------

export type ForumPostDto = {
  id: string;
  institution_id: string;
  author_id: string;
  subject: string;
  title: string;
  content: string;
  created_at: string;
};

export type ForumCommentDto = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export async function qForumPosts(subject: string | null): Promise<ForumPostDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  let q = getDb()
    .from("forum_posts")
    .select("id, institution_id, author_id, subject, title, content, created_at")
    .eq("institution_id", actor.institution_id);
  if (subject) q = q.eq("subject", subject);
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as ForumPostDto[];
}

export async function qForumPost(postId: string): Promise<ForumPostDto | null> {
  const actor = await getActor();
  if (!actor?.institution_id || !postId) return null;
  const { data } = await getDb()
    .from("forum_posts")
    .select("id, institution_id, author_id, subject, title, content, created_at")
    .eq("id", postId)
    .maybeSingle<ForumPostDto>();
  return data && data.institution_id === actor.institution_id ? data : null;
}

export async function qForumComments(postId: string): Promise<ForumCommentDto[]> {
  const post = await qForumPost(postId);
  if (!post) return [];
  const { data } = await getDb()
    .from("forum_comments")
    .select("id, post_id, author_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ForumCommentDto[];
}

/** Display names for people in the caller's centre (others are left out). */
export async function qPeopleNames(ids: string[]): Promise<Record<string, string>> {
  const actor = await getActor();
  if (!actor?.institution_id) return {};
  const unique = [...new Set((ids ?? []).filter((x) => typeof x === "string" && x))].slice(0, 300);
  if (!unique.length) return {};
  const { data } = await getDb().from("profiles").select("id, full_name, email, institution_id").in("id", unique);
  const map: Record<string, string> = {};
  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null; institution_id: string | null }[]) {
    if (p.institution_id === actor.institution_id) map[p.id] = p.full_name || p.email || "Member";
  }
  return map;
}

// ---- Materials and quizzes ------------------------------------------------------------------

export type MaterialDto = {
  id: string;
  title: string;
  content_url: string | null;
  description: string | null;
  subject: string | null;
  cohort_id: string | null;
  created_at: string;
};

export async function qMaterials(opts?: { subject?: string | null }): Promise<MaterialDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  let q = getDb()
    .from("materials")
    .select("id, title, content_url, description, subject, cohort_id, created_at")
    .eq("institution_id", actor.institution_id);
  if (opts?.subject) q = q.eq("subject", opts.subject);
  const { data } = await q.order("created_at", { ascending: false });
  let rows = (data ?? []) as MaterialDto[];
  if (!isStaff(actor)) {
    const cohort = actor.profile?.cohort_id ?? null;
    rows = rows.filter((m) => m.cohort_id === null || m.cohort_id === cohort);
  }
  return rows;
}

export type QuizSummaryDto = {
  id: string;
  title: string;
  cohort_id: string | null;
  time_limit_minutes: number;
  max_focus_violations: number;
  question_count: number;
  due_at: string | null;
  created_at: string;
};

function toQuizSummary(q: Record<string, unknown>): QuizSummaryDto {
  return {
    id: q.id as string,
    title: q.title as string,
    cohort_id: (q.cohort_id as string | null) ?? null,
    time_limit_minutes: Number(q.time_limit_minutes ?? 30),
    max_focus_violations: Number(q.max_focus_violations ?? 2),
    question_count: Array.isArray(q.questions) ? q.questions.length : 0,
    due_at: (q.due_at as string | null) ?? null,
    created_at: q.created_at as string,
  };
}

/** Quizzes without questions, answers or passwords. Students see their cohort's only. */
export async function qQuizzes(): Promise<QuizSummaryDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  let q = getDb()
    .from("quizzes")
    .select("id, title, cohort_id, time_limit_minutes, max_focus_violations, questions, due_at, created_at")
    .eq("institution_id", actor.institution_id);
  if (!isStaff(actor)) {
    if (!actor.profile?.cohort_id) return [];
    q = q.eq("cohort_id", actor.profile.cohort_id);
  }
  const { data } = await q.order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(toQuizSummary);
}

// ---- Results ------------------------------------------------------------------

export type AttemptDto = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  student_id: string;
  student_name: string | null;
  score: number | null;
  status: string;
  submitted_reason: string;
  focus_violations: number;
  time_spent_seconds: number;
  submitted_at: string;
};

async function quizTitlesFor(institutionId: string) {
  const { data } = await getDb().from("quizzes").select("id, title").eq("institution_id", institutionId);
  const titles: Record<string, string> = {};
  for (const q of (data ?? []) as { id: string; title: string }[]) titles[q.id] = q.title;
  return titles;
}

/** Staff: attempts on their centre's quizzes. Students: their own attempts. */
export async function qAttempts(): Promise<AttemptDto[]> {
  const actor = await getActor();
  if (!actor?.institution_id) return [];
  const titles = await quizTitlesFor(actor.institution_id);
  const quizIds = Object.keys(titles);
  if (!quizIds.length) return [];
  let q = getDb()
    .from("quiz_attempts")
    .select("id, quiz_id, student_id, score, status, submitted_reason, focus_violations, time_spent_seconds, submitted_at")
    .in("quiz_id", quizIds);
  if (!isStaff(actor)) q = q.eq("student_id", actor.user.id);
  const { data } = await q.order("submitted_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as Omit<AttemptDto, "quiz_title" | "student_name">[];
  const names = isStaff(actor) ? await qPeopleNames(rows.map((r) => r.student_id)) : {};
  return rows.map((a) => ({
    ...a,
    quiz_title: titles[a.quiz_id] ?? "Quiz",
    student_name: isStaff(actor) ? names[a.student_id] ?? "Former student" : null,
  }));
}

// ---- People lists for staff screens ------------------------------------------------------------------

export type PersonDto = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  cohort_id: string | null;
  deleted_at: string | null;
};

export async function qPeople(role: "tutor" | "student", opts?: { includeRecentlyRemoved?: boolean }): Promise<PersonDto[]> {
  const actor = await getActor([...STAFF]);
  if (!actor?.institution_id) return [];
  let q = getDb()
    .from("profiles")
    .select("id, email, full_name, role, cohort_id, deleted_at")
    .eq("institution_id", actor.institution_id)
    .eq("role", role);
  if (opts?.includeRecentlyRemoved) {
    q = q.or(`deleted_at.is.null,deleted_at.gte.${new Date(Date.now() - RECOVERY_MS).toISOString()}`);
  } else {
    q = q.is("deleted_at", null);
  }
  const { data } = await q.order(role === "student" ? "full_name" : "created_at", {
    ascending: role === "student",
  });
  return (data ?? []) as PersonDto[];
}

export type PaymentDto = { id: string; student_id: string; amount: number; paid_at: string };

export async function qCashPayments(): Promise<PaymentDto[]> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) return [];
  const { data } = await getDb()
    .from("cash_payments")
    .select("id, student_id, amount, paid_at")
    .eq("institution_id", actor.institution_id)
    .order("paid_at", { ascending: false });
  return (data ?? []) as PaymentDto[];
}

// ---- Student report ------------------------------------------------------------------

export type StudentReportDto = {
  attendancePct: number;
  totalDays: number;
  presentDays: number;
  quizAvg: number;
  attempts: { quiz_title: string; score: number; submitted_at: string }[];
  materials: { title: string; subject: string | null }[];
};

export async function qStudentReport(studentId: string, startDate: string, endDate: string): Promise<StudentReportDto | null> {
  const actor = await getActor([...STAFF]);
  if (!actor?.institution_id) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  if (!(await profileBelongsTo(studentId, actor.institution_id, "student"))) return null;

  const db = getDb();
  const [attendance, attempts, profile, titles] = await Promise.all([
    db
      .from("attendance")
      .select("status, date")
      .eq("student_id", studentId)
      .eq("institution_id", actor.institution_id)
      .gte("date", startDate)
      .lte("date", endDate),
    db
      .from("quiz_attempts")
      .select("quiz_id, score, submitted_at, status")
      .eq("student_id", studentId)
      .gte("submitted_at", startDate)
      .lte("submitted_at", `${endDate}T23:59:59.999Z`),
    db.from("profiles").select("cohort_id").eq("id", studentId).maybeSingle(),
    quizTitlesFor(actor.institution_id),
  ]);

  const att = (attendance.data ?? []) as { status: string }[];
  const presentDays = att.filter((r) => r.status === "present").length;
  const done = ((attempts.data ?? []) as { quiz_id: string; score: number | null; submitted_at: string; status: string }[])
    .filter((a) => a.status !== "in_progress" && titles[a.quiz_id])
    .map((a) => ({ quiz_title: titles[a.quiz_id], score: Number(a.score ?? 0), submitted_at: a.submitted_at }));

  let materials: { title: string; subject: string | null }[] = [];
  const cohortId = profile.data?.cohort_id as string | null | undefined;
  if (cohortId) {
    const { data: mat } = await db
      .from("materials")
      .select("title, subject")
      .eq("institution_id", actor.institution_id)
      .eq("cohort_id", cohortId);
    materials = (mat ?? []) as { title: string; subject: string | null }[];
  }

  return {
    attendancePct: att.length ? (presentDays / att.length) * 100 : 0,
    totalDays: att.length,
    presentDays,
    quizAvg: done.length ? done.reduce((s, a) => s + a.score, 0) / done.length : 0,
    attempts: done,
    materials,
  };
}

// ---- Notifications ------------------------------------------------------------------

export type NotificationDto = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "fee_reminder" | "quiz_result" | "announcement";
  is_read: boolean;
  created_at: string;
};

export async function qNotifications(): Promise<NotificationDto[]> {
  const actor = await getActor();
  if (!actor) return [];
  const { data } = await getDb()
    .from("notifications")
    .select("id, user_id, title, message, type, is_read, created_at")
    .eq("user_id", actor.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as NotificationDto[];
}

export async function qUnreadCount(): Promise<number> {
  const actor = await getActor();
  if (!actor) return 0;
  const { count } = await getDb()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", actor.user.id)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const actor = await getActor();
  if (!actor || !id) return;
  await getDb().from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", actor.user.id);
}

export async function markAllNotificationsRead(): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  await getDb()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", actor.user.id)
    .eq("is_read", false);
}
