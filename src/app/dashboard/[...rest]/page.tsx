import { redirect } from "next/navigation";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

type InstRole = "student" | "tutor" | "headmaster";
const MAP: Record<string, Partial<Record<InstRole, string>>> = {
  staff: { headmaster: "/headmaster/staff" },
  cohorts: { headmaster: "/headmaster/cohorts", tutor: "/tutor/cohorts" },
  payments: { headmaster: "/headmaster/payments" },
  settings: {
    headmaster: "/headmaster/settings",
    student: "/student/settings",
    tutor: "/tutor/settings",
  },
  "settings/profile": {
    headmaster: "/headmaster/settings",
    student: "/student/settings/profile",
    tutor: "/tutor/settings",
  },
  learn: { student: "/student/learn" },
  "mobile-setup": { student: "/student/mobile-setup" },
  timetable: { student: "/student/timetable", tutor: "/tutor/timetable", headmaster: "/headmaster" },
  community: { student: "/student/community", tutor: "/tutor/community", headmaster: "/headmaster" },
  attendance: { tutor: "/tutor/attendance", headmaster: "/headmaster" },
  materials: { tutor: "/tutor/subjects", headmaster: "/headmaster" },
  quizzes: { tutor: "/tutor/quizzes", headmaster: "/headmaster" },
};

/** Legacy `/dashboard/*` URLs → role-isolated routes (no shared dashboard layout). */
export default async function DashboardLegacyRedirect({
  params,
}: {
  params: Promise<{ rest: string[] }>;
}) {
  const { rest } = await params;
  const first = rest?.[0] ?? "";
  const pathKey = rest?.length === 2 ? `${rest[0]}/${rest[1]}` : first;

  const identity = await getUserIdentity();
  if (!identity) redirect("/login");

  const role = identity.role as "admin" | InstRole | undefined;

  if (role === "admin") redirect("/admin");
  if (role !== "student" && role !== "tutor" && role !== "headmaster") redirect("/dashboard");

  const mapped = MAP[pathKey]?.[role as InstRole] ?? MAP[first]?.[role as InstRole];
  redirect(mapped ?? "/dashboard");
}
