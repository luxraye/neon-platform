import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/lib/server/db";
import { AdminBillingContent } from "./admin-billing-content";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const admin = getDb();

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, name, subscription_tier")
    .order("name");

  const { data: students } = await admin
    .from("profiles")
    .select("institution_id")
    .eq("role", "student")
    .is("deleted_at", null);
  const studentCounts: Record<string, number> = {};
  for (const s of (students ?? []) as { institution_id: string | null }[]) {
    if (s.institution_id) studentCounts[s.institution_id] = (studentCounts[s.institution_id] ?? 0) + 1;
  }

  const { data: reports } = await admin
    .from("financial_reports")
    .select("id, institution_id, report_month, student_count, total_revenue_due, status")
    .order("report_month", { ascending: false })
    .limit(50);

  const instById = Object.fromEntries((institutions ?? []).map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Monthly invoices for each centre, based on plan and active students." />
      <AdminBillingContent
        institutions={institutions ?? []}
        studentCounts={studentCounts}
        financialReports={reports ?? []}
        instByName={instById}
      />
    </div>
  );
}
