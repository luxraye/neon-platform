import { redirect } from "next/navigation";
import { getUserIdentity } from "@/lib/auth/identity";

export const dynamic = "force-dynamic";

type InstRole = "student" | "tutor" | "headmaster";

/** Pages each role actually has, relative to its root (e.g. /tutor). */
const ROUTES: Record<InstRole, string[]> = {
  headmaster: ["cohorts", "payments", "pricing", "reports", "results", "settings", "staff", "timetable"],
  tutor: ["attendance", "cohorts", "community", "materials", "quizzes", "quizzes/new", "reports", "results", "settings", "subjects", "timetable"],
  student: ["community", "learn", "mobile-setup", "results", "settings", "timetable"],
};

/** Old names that moved. */
const ALIASES: Record<string, string> = {
  "settings/profile": "settings",
  "learn/progress": "results",
  profile: "settings",
};

/** Legacy `/dashboard/*` links go to the same page under the user's own role, or their home. */
export default async function DashboardLegacyRedirect({ params }: { params: Promise<{ rest: string[] }> }) {
  const { rest } = await params;
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.role === "admin") redirect("/admin");

  const role = identity.role as InstRole;
  if (!ROUTES[role]) redirect("/login");

  const raw = (rest ?? []).join("/");
  const path = ALIASES[raw] ?? raw;
  if (ROUTES[role].includes(path)) redirect(`/${role}/${path}`);
  if (path.startsWith("community/") && ROUTES[role].includes("community")) redirect(`/${role}/${path}`);
  redirect(`/${role}`);
}
