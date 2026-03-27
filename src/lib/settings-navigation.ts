/**
 * Back navigation from legacy / profile placeholder routes.
 */

/** Parent "settings" or home screen for back navigation. */
export function getSettingsParentPath(pathname: string | null | undefined): string {
  if (!pathname) return "/student/settings";
  if (pathname.startsWith("/headmaster")) return "/headmaster/settings";
  if (pathname.startsWith("/tutor")) return "/tutor/settings";
  if (pathname.startsWith("/student")) return "/student/settings";
  return "/student/settings";
}

export function getSettingsBackLabel(pathname: string | null | undefined): string {
  if (pathname?.startsWith("/student")) return "← My Learning";
  return "← Settings";
}
