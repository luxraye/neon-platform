import { redirect } from "next/navigation";
import { RoleShell } from "@/components/navigation/RoleShell";
import HeadmasterSidebar from "@/components/navigation/HeadmasterSidebar";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

export default async function HeadmasterLayout({ children }: { children: React.ReactNode }) {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");

  if (identity.deleted_at) redirect("/deactivated");
  if (identity.role !== "headmaster") redirect("/unauthorized");
  if (!identity.institution_id) redirect("/unauthorized");

  const title = identity.institution_name ? `Headmaster: ${identity.institution_name}` : "Headmaster";

  return (
    <RoleShell
      Sidebar={HeadmasterSidebar}
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

