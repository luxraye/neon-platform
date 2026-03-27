import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AdminLeadsContent } from "./admin-leads-content";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const admin = createServiceRoleClient();

  const { data: leads } = await admin
    .from("leads")
    .select("id, name, email, institution_name, message, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-muted-foreground text-sm">Contact form inbox — provision a center from a lead</p>
      </div>
      <AdminLeadsContent leads={leads ?? []} />
    </div>
  );
}
