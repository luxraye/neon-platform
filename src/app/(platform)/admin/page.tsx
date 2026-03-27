import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AdminDashboard } from "./admin-dashboard";
import { getPendingDeletions } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = createServiceRoleClient();
  const pendingDeletions = await getPendingDeletions();

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, name, subdomain, subscription_tier, is_trial, trial_ends_at, created_at")
    .order("created_at", { ascending: false });

  const institutionIds = (institutions ?? []).map((i) => i.id);
  const studentCounts: Record<string, number> = {};
  if (institutionIds.length > 0) {
    for (const id of institutionIds) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("institution_id", id)
        .eq("role", "student")
        .is("deleted_at", null);
      studentCounts[id] = count ?? 0;
    }
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

