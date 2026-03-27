import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AdminFeedbackContent } from "./admin-feedback-content";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  created_by: string;
  institution_id: string | null;
  feedback_type: string;
  area: string;
  severity: string;
  summary: string;
  details: string | null;
  screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

export default async function AdminFeedbackPage() {
  const admin = createServiceRoleClient();

  const { data: feedbackRows } = await admin
    .from("user_feedback")
    .select("id, created_by, institution_id, feedback_type, area, severity, summary, details, screenshot_url, status, admin_notes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const createdByIds = Array.from(new Set((feedbackRows ?? []).map((r) => r.created_by)));
  const userMap: Record<string, { full_name: string | null; email: string | null }> = {};
  if (createdByIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", createdByIds);
    for (const p of profiles ?? []) {
      userMap[p.id] = { full_name: p.full_name, email: p.email };
    }
  }

  const institutionMap: Record<string, string> = {};
  const institutionIds = Array.from(
    new Set((feedbackRows ?? []).map((r) => r.institution_id).filter((v): v is string => !!v))
  );
  if (institutionIds.length > 0) {
    const { data: institutions } = await admin.from("institutions").select("id, name").in("id", institutionIds);
    for (const inst of institutions ?? []) {
      institutionMap[inst.id] = inst.name;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User feedback</h1>
        <p className="text-muted-foreground text-sm">
          Review user challenges and recommendations from all role dashboards.
        </p>
      </div>
      <AdminFeedbackContent
        feedbackRows={(feedbackRows ?? []) as FeedbackRow[]}
        userMap={userMap}
        institutionMap={institutionMap}
      />
    </div>
  );
}
