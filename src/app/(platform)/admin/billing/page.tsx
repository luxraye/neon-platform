import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AdminBillingContent } from "./admin-billing-content";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const admin = createServiceRoleClient();

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, name, subscription_tier")
    .order("name");

  const institutionIds = (institutions ?? []).map((i) => i.id);
  const studentCounts: Record<string, number> = {};
  for (const id of institutionIds) {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", id)
      .eq("role", "student");
    studentCounts[id] = count ?? 0;
  }

  const { data: reports } = await admin
    .from("financial_reports")
    .select("id, institution_id, report_month, student_count, total_revenue_due, status")
    .order("report_month", { ascending: false })
    .limit(50);

  const instById = Object.fromEntries((institutions ?? []).map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm">Base tier fees and per-student billing</p>
      </div>
      <AdminBillingContent
        institutions={institutions ?? []}
        studentCounts={studentCounts}
        financialReports={reports ?? []}
        instByName={instById}
      />
    </div>
  );
}
