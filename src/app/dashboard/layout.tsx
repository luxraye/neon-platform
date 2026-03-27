/**
 * Pass-through only: no shared dashboard chrome (RoleShell lives under
 * `app/(institution)/{headmaster,tutor,student}`). Keeps `/dashboard/*` implementation
 * routes valid without leaking a second shell around role-isolated areas.
 */
export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
