/**
 * Role-based access for dashboard routes. Used by sidebar filtering and page-level guards.
 */
export type DashboardRole = "student" | "tutor" | "headmaster";

/** Path prefix -> allowed roles. First matching prefix wins. */
export const DASHBOARD_ROUTE_ROLES: { path: string; roles: DashboardRole[] }[] = [
  { path: "/dashboard/cohorts", roles: ["headmaster"] },
  { path: "/dashboard/staff", roles: ["headmaster"] },
  { path: "/dashboard/materials", roles: ["tutor", "headmaster"] },
  { path: "/dashboard/quizzes", roles: ["tutor", "headmaster"] },
  { path: "/dashboard/results", roles: ["student", "tutor", "headmaster"] },
  { path: "/dashboard/learn/progress", roles: ["student"] },
  { path: "/dashboard/learn", roles: ["student"] },
  { path: "/dashboard/attendance", roles: ["tutor", "headmaster"] },
  { path: "/dashboard/payments", roles: ["headmaster"] },
  { path: "/dashboard/pricing", roles: ["headmaster"] },
  { path: "/dashboard/mobile-setup", roles: ["student"] },
  { path: "/dashboard/reports", roles: ["student", "tutor", "headmaster"] },
  { path: "/dashboard/community", roles: ["student", "tutor", "headmaster"] },
  { path: "/dashboard/timetable", roles: ["student", "tutor", "headmaster"] },
  { path: "/dashboard/settings", roles: ["student", "headmaster"] },
  { path: "/student/settings", roles: ["student"] },
  { path: "/dashboard", roles: ["student", "tutor", "headmaster"] },
];

export function getAllowedRolesForPath(pathname: string): DashboardRole[] {
  const normalized = pathname.replace(/\/$/, "") || "/dashboard";
  for (const { path, roles } of DASHBOARD_ROUTE_ROLES) {
    if (normalized === path || (path !== "/dashboard" && normalized.startsWith(path + "/")))
      return roles;
  }
  return ["student", "tutor", "headmaster"];
}

export function checkRole(pathname: string, role: string | undefined): boolean {
  if (!role || role === "admin") return true;
  const allowed = getAllowedRolesForPath(pathname);
  return allowed ? allowed.includes(role as DashboardRole) : true;
}
