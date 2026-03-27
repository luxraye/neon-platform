import { redirect } from "next/navigation";
import { RoleShell } from "@/components/navigation/RoleShell";
import StudentSidebar from "@/components/navigation/StudentSidebar";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.deleted_at) redirect("/deactivated");
  if (identity.role !== "student") redirect("/unauthorized");
  if (!identity.institution_id) redirect("/unauthorized");

  const title = identity.institution_name ? `Student: ${identity.institution_name}` : "Student";

  return (
    <RoleShell
      Sidebar={StudentSidebar}
      sidebarProps={{ institutionName: identity.institution_name }}
      branding={{
        primaryColor: identity.institution_primary_color,
        logoUrl: identity.institution_logo_url,
      }}
      title={title}
    >
      {children}
    </RoleShell>
  );
}

