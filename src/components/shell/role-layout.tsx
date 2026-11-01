import { redirect } from "next/navigation";
import { getUserIdentity } from "@/lib/auth/identity";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellRole } from "@/components/shell/nav";

/** Server-side guard + shell shared by the admin, headmaster, tutor and student areas. */
export async function RoleLayout({ role, children }: { role: ShellRole; children: React.ReactNode }) {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.deleted_at) redirect("/deactivated");
  if (identity.role !== role) redirect("/unauthorized");
  if (role !== "admin" && !identity.institution_id) redirect("/unauthorized");

  return (
    <AppShell
      role={role}
      user={{ id: identity.user.id, name: identity.profile?.full_name ?? null, email: identity.user.email }}
      centre={{
        name: role === "admin" ? "Neon HQ" : identity.institution_name,
        logoUrl: identity.institution_logo_url,
        primaryColor: identity.institution_primary_color,
      }}
      hasCohort={!!identity.profile?.cohort_id}
    >
      {children}
    </AppShell>
  );
}
