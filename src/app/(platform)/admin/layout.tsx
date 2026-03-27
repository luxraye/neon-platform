import { redirect } from "next/navigation";
import { RoleShell } from "@/components/navigation/RoleShell";
import AdminSidebar from "@/components/navigation/AdminSidebar";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  if (identity.deleted_at) redirect("/deactivated");
  if (identity.role !== "admin") redirect("/unauthorized");

  return (
    <RoleShell Sidebar={AdminSidebar} title="Platform Admin">
      {children}
    </RoleShell>
  );
}
