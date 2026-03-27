"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FEEDBACK_AREAS, FEEDBACK_STATUSES } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function AdminFeedbackContent({
  feedbackRows,
  userMap,
  institutionMap,
}: {
  feedbackRows: FeedbackRow[];
  userMap: Record<string, { full_name: string | null; email: string | null }>;
  institutionMap: Record<string, string>;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedbackRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (areaFilter !== "all" && row.area !== areaFilter) return false;
      if (!q) return true;
      const identity = userMap[row.created_by];
      const haystack = [
        row.summary,
        row.details ?? "",
        row.area,
        row.feedback_type,
        identity?.full_name ?? "",
        identity?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [feedbackRows, statusFilter, areaFilter, search, userMap]);

  const getStatus = (row: FeedbackRow) => statusDrafts[row.id] ?? row.status;
  const getNotes = (row: FeedbackRow) => notesDrafts[row.id] ?? row.admin_notes ?? "";

  const updateRow = async (row: FeedbackRow) => {
    const status = getStatus(row);
    const adminNotes = getNotes(row);
    setUpdatingId(row.id);
    const { updateFeedbackStatus } = await import("../actions");
    const result = await updateFeedbackStatus({
      feedbackId: row.id,
      status: status as "new" | "reviewing" | "planned" | "resolved" | "dismissed",
      adminNotes,
    });
    setUpdatingId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Feedback status updated.");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Review queue</CardTitle>
        <CardDescription>Track, prioritize, and close user-reported challenges.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search summary, details, user..."
          />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
          >
            <option value="all">All areas</option>
            {FEEDBACK_AREAS.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback matches your filters.</p>
          ) : (
            filteredRows.map((row) => {
              const identity = userMap[row.created_by];
              const institutionName = row.institution_id ? institutionMap[row.institution_id] ?? "Unknown institution" : "Platform";
              return (
                <div key={row.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded border px-2 py-0.5 capitalize">{row.feedback_type}</span>
                    <span className="rounded border px-2 py-0.5 capitalize">{row.area}</span>
                    <span className="rounded border px-2 py-0.5 capitalize">{row.severity}</span>
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{row.summary}</p>
                    {row.details && <p className="mt-1 text-sm text-muted-foreground">{row.details}</p>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>
                      By: {identity?.full_name || identity?.email || "Unknown user"} | Institution: {institutionName}
                    </p>
                    {row.screenshot_url && (
                      <a
                        href={row.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        View screenshot
                      </a>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                    <select
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
                      value={getStatus(row)}
                      onChange={(e) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                    >
                      {FEEDBACK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={getNotes(row)}
                      onChange={(e) =>
                        setNotesDrafts((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      placeholder="Admin notes (optional)"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={updatingId === row.id}
                      onClick={() => updateRow(row)}
                    >
                      {updatingId === row.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
