import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/lib/server/db";
import { AdminLeadsContent } from "./admin-leads-content";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const admin = getDb();

  const { data: leads } = await admin
    .from("leads")
    .select("id, name, email, institution_name, message, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Demo requests from the website. Turn a lead into a centre in one step." />
      <AdminLeadsContent leads={leads ?? []} />
    </div>
  );
}
