import { getDb } from "@/lib/server/db";
import { AdminDashboard } from "./admin-dashboard";
import { getPendingDeletions } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = getDb();
  const pendingDeletions = await getPendingDeletions();

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, name, subdomain, subscription_tier, is_trial, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  // One read for all students instead of one count per centre.
  const { data: students } = await admin
    .from("profiles")
    .select("institution_id")
    .eq("role", "student")
    .is("deleted_at", null);
  const studentCounts: Record<string, number> = {};
  for (const s of (students ?? []) as { institution_id: string | null }[]) {
    if (s.institution_id) studentCounts[s.institution_id] = (studentCounts[s.institution_id] ?? 0) + 1;
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id, name, email, institution_name, message, status, created_at")
    .order("created_at", { ascending: false });

  const unreadLeadsCount = (leads ?? []).filter((l) => l.status !== "converted").length;

  return (
    <AdminDashboard
      institutions={institutions ?? []}
      studentCounts={studentCounts}
      leads={leads ?? []}
      unreadLeadsCount={unreadLeadsCount}
      pendingDeletions={pendingDeletions}
    />
  );
}

