"use client";

import { useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StudentOption = { id: string; label: string };
type AttemptRow = { quiz_title: string; score: number; submitted_at: string };
type MaterialRow = { title: string; subject: string | null };

const RANGES: { value: string; label: string; days: number }[] = [
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 3 months", days: 90 },
  { value: "180", label: "Last 6 months", days: 180 },
];

function useInstitutionStudents(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["reports-students", institutionId ?? ""],
    queryFn: async (): Promise<StudentOption[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, cohort_id")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .order("full_name");
      if (error) throw error;
      return (data ?? []).map((p: { id: string; full_name: string | null; email: string }) => ({
        id: p.id,
        label: p.full_name || p.email,
      }));
    },
    enabled: !!institutionId,
  });
}

function useReportData(
  studentId: string | null,
  startDate: string,
  endDate: string
) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["report-data", studentId ?? "", startDate, endDate],
    queryFn: async () => {
      if (!studentId) return null;
      const [attendance, attempts, profile] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, status, date")
          .eq("student_id", studentId)
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("quiz_attempts")
          .select("id, quiz_id, score, submitted_at")
          .eq("student_id", studentId)
          .gte("submitted_at", startDate)
          .lte("submitted_at", endDate + "T23:59:59"),
        supabase.from("profiles").select("cohort_id").eq("id", studentId).single(),
      ]);
      if (attendance.error) throw attendance.error;
      if (attempts.error) throw attempts.error;
      const cohortId = profile.data?.cohort_id;
      let materials: MaterialRow[] = [];
      let attemptsWithTitle: AttemptRow[] = [];
      if (attempts.data?.length) {
        const quizIds = [...new Set(attempts.data.map((a: { quiz_id: string }) => a.quiz_id))];
        const { data: quizzes } = await supabase
          .from("quizzes")
          .select("id, title")
          .in("id", quizIds);
        const titleById: Record<string, string> = {};
        (quizzes ?? []).forEach((q: { id: string; title: string }) => {
          titleById[q.id] = q.title;
        });
        attemptsWithTitle = (attempts.data ?? []).map((a: { quiz_id: string; score: number; submitted_at: string }) => ({
          quiz_title: titleById[a.quiz_id] ?? "Quiz",
          score: a.score,
          submitted_at: a.submitted_at,
        }));
      }
      if (cohortId) {
        const { data: mat } = await supabase
          .from("materials")
          .select("title, subject")
          .eq("cohort_id", cohortId);
        materials = (mat ?? []) as MaterialRow[];
      }
      const totalDays = (attendance.data ?? []).length;
      const present = (attendance.data ?? []).filter((r: { status: string }) => r.status === "present").length;
      const attendancePct = totalDays ? (present / totalDays) * 100 : 0;
      const quizAvg =
        attemptsWithTitle.length
          ? attemptsWithTitle.reduce((s, a) => s + a.score, 0) / attemptsWithTitle.length
          : 0;
      return {
        attendancePct,
        totalDays,
        present,
        quizAvg,
        attempts: attemptsWithTitle,
        materials,
      };
    },
    enabled: !!studentId && !!startDate && !!endDate,
  });
}

export default function ReportsPage() {
  const { data: profileData } = useProfile();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const isHeadmaster = profileData?.profile?.role === "headmaster";
  const currentUserId = profileData?.user?.id ?? null;

  const { data: students } = useInstitutionStudents(institutionId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(90);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - rangeDays);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const effectiveStudentId = isHeadmaster ? selectedStudentId : currentUserId;
  const { data: report, isLoading } = useReportData(
    effectiveStudentId,
    startDate,
    endDate
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Performance Report</h1>

      <div className="flex flex-wrap gap-4 mb-6 print:hidden">
        {isHeadmaster && (
          <div>
            <Label className="mr-2">Student</Label>
            <Select
              value={effectiveStudentId ?? ""}
              onValueChange={(v) => setSelectedStudentId(v || null)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="mr-2">Timeframe</Label>
          <Select
            value={String(rangeDays)}
            onValueChange={(v) => setRangeDays(Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={handlePrint} className="print:hidden">
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {!effectiveStudentId && (
        <p className="text-muted-foreground">Select a student to generate a report.</p>
      )}
      {effectiveStudentId && isLoading && <p className="text-muted-foreground">Loading report…</p>}
      {effectiveStudentId && !isLoading && report && (
        <div id="report-print-area" className="rounded-lg border bg-card p-6 print:border-0 print:shadow-none">
          <h2 className="text-lg font-semibold mb-4">Performance Report</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {startDate} – {endDate}
          </p>

          <div className="grid gap-6 sm:grid-cols-2 mb-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Attendance</h3>
              <p className="text-2xl font-semibold">{report.attendancePct.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">
                {report.present} present of {report.totalDays} days marked
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Quiz average</h3>
              <p className="text-2xl font-semibold">{report.quizAvg.toFixed(0)}%</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2">Quiz attempts</h3>
            {report.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attempts in this period.</p>
            ) : (
              <ul className="list-disc list-inside text-sm space-y-1">
                {report.attempts.map((a, i) => (
                  <li key={i}>
                    {a.quiz_title}: {a.score.toFixed(0)}% —{" "}
                    {new Date(a.submitted_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Materials (assigned to cohort)</h3>
            {report.materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="list-disc list-inside text-sm space-y-1">
                {report.materials.map((m, i) => (
                  <li key={i}>
                    {m.title}
                    {m.subject ? ` (${m.subject})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
