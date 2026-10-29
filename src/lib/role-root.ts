/** The URL prefix for a signed-in role, e.g. "/tutor". Falls back to the current path's prefix. */
export function roleRoot(role: string | null | undefined, pathname?: string | null): string {
  if (role === "headmaster" || role === "tutor" || role === "student" || role === "admin") return `/${role}`;
  const first = (pathname ?? "").split("/")[1];
  if (first === "headmaster" || first === "tutor" || first === "student") return `/${first}`;
  return "/dashboard";
}
