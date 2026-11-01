"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { qPeople, qStudentReport } from "@/app/data/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { LogoMark } from "@/components/brand/logo";

const RANGES = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
];

const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const nice = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function grade(pct: number) {
  if (pct >= 80) return { label: "Excellent", tone: "text-success" };
  if (pct >= 65) return { label: "Good", tone: "text-primary" };
  if (pct >= 50) return { label: "Fair", tone: "text-warning" };
  return { label: "Needs support", tone: "text-destructive" };
}

export default function ReportsPage() {
  const { data: me } = useProfile();
  const role = me?.profile?.role;
  const isStaff = role === "headmaster" || role === "tutor";
  const institution = me?.institution;

  const { data: students } = useQuery({
    queryKey: ["reports-students"],
    queryFn: async () => (await qPeople("student")).map((p) => ({ id: p.id, label: p.full_name || p.email })),
    enabled: isStaff,
  });
  const [studentId, setStudentId] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [comment, setComment] = useState("");

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = ymd(start);
  const endDate = ymd(end);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-data", studentId ?? "", startDate, endDate],
    queryFn: () => qStudentReport(studentId!, startDate, endDate),
    enabled: !!studentId,
  });

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" />
        <EmptyState icon={FileText} title="Staff only" body="Ask your tutor or headmaster for a printed report." />
      </div>
    );
  }

  const g = report ? grade(report.quizAvg) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        className="print:hidden"
        title="Reports"
        description="A one-page report card for any student. Print it or save it as a PDF for parents."
        actions={
          report ? (
            <Button onClick={() => window.print()}>
              <Printer /> Print or save PDF
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <Select value={studentId ?? ""} onValueChange={(v) => setStudentId(v || null)}>
          <SelectTrigger className="sm:w-72" aria-label="Student">
            <SelectValue placeholder="Choose a student" />
          </SelectTrigger>
          <SelectContent>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="sm:w-48" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.days} value={String(r.days)}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!studentId ? (
        <EmptyState icon={FileText} title="Choose a student" body="Their attendance and quiz results for the period appear as a printable report." />
      ) : isLoading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      ) : !report ? (
        <EmptyState title="No report" body="That student isn't in your centre." />
      ) : (
        <div id="report-print-area" className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-10 print:max-w-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
            <div className="flex items-center gap-3">
              {institution?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote logo
                <img src={institution.logo_url} alt="" className="size-12 rounded-xl object-contain" />
              ) : (
                <LogoMark className="size-12" />
              )}
              <div>
                <p className="text-lg font-extrabold">{institution?.name ?? "Your centre"}</p>
                <p className="text-sm text-muted-foreground">Student progress report</p>
              </div>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {nice(startDate)} to
              <br />
              {nice(endDate)}
            </p>
          </header>

          <section className="mt-6">
            <p className="text-2xl font-extrabold">{report.studentName}</p>
            {report.cohortName ? <p className="text-sm text-muted-foreground">{report.cohortName}</p> : null}
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
              <p className="mt-1 text-3xl font-extrabold">{report.totalDays ? `${Math.round(report.attendancePct)}%` : "–"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.presentDays} present · {report.lateDays} late · {report.absentDays} absent
              </p>
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz average</p>
              <p className="mt-1 text-3xl font-extrabold">{report.attempts.length ? `${Math.round(report.quizAvg)}%` : "–"}</p>
              {report.attempts.length && g ? <p className={cn("mt-1 text-xs font-semibold", g.tone)}>{g.label}</p> : <p className="mt-1 text-xs text-muted-foreground">No quizzes yet</p>}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-bold">Quizzes</h2>
            {report.attempts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No quizzes in this period.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-border">
                  {report.attempts.map((a, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3">{a.quiz_title}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                      <td className="w-32 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted print:border print:border-border">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(a.score, 100)}%` }} />
                          </div>
                          <span className="w-9 text-right font-semibold tabular-nums">{Math.round(a.score)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-bold">Comment</h2>
            <Textarea
              className="mt-2 print:hidden"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for the parent. It prints with the report and isn't saved."
            />
            <p className="mt-2 hidden min-h-16 whitespace-pre-wrap text-sm print:block">{comment || " "}</p>
          </section>

          <footer className="mt-10 flex items-end justify-between gap-6 text-xs text-muted-foreground">
            <div className="w-48 border-t border-foreground/40 pt-1">Signed</div>
            <p>Generated with Neon · {nice(endDate)}</p>
          </footer>
        </div>
      )}
    </div>
  );
}
