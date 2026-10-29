"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpenCheck, Clock, Search, Target, Trophy } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { qAttempts, type AttemptDto } from "@/app/data/queries";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui/page";

function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-foreground";
  return "text-destructive";
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.max(0, Math.min(score, 100)) / 100) * c}
          className={cn(score >= 75 ? "stroke-success" : score >= 50 ? "stroke-primary" : "stroke-destructive")}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", scoreTone(score))}>
        {Math.round(score)}
      </span>
    </div>
  );
}

const REASON: Record<string, string> = {
  manual: "Submitted",
  timer_expired: "Time ran out",
  security_violation: "Left the quiz too often",
};

export default function ResultsPage() {
  const { data: me } = useProfile();
  const role = me?.profile?.role ?? null;
  const isStudent = role === "student";
  const [search, setSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["results-attempts"],
    queryFn: () => qAttempts(),
    enabled: !!role,
  });

  const attempts = useMemo(() => (data ?? []).filter((a) => a.status !== "in_progress"), [data]);
  const quizzes = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attempts) m.set(a.quiz_id, a.quiz_title);
    return [...m.entries()];
  }, [attempts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attempts.filter(
      (a) =>
        (quizFilter === "all" || a.quiz_id === quizFilter) &&
        (!q || a.quiz_title.toLowerCase().includes(q) || (a.student_name ?? "").toLowerCase().includes(q))
    );
  }, [attempts, search, quizFilter]);

  const avg = filtered.length ? filtered.reduce((s, a) => s + (a.score ?? 0), 0) / filtered.length : null;
  const best = filtered.length ? Math.max(...filtered.map((a) => a.score ?? 0)) : null;
  const flagged = filtered.filter((a) => a.submitted_reason === "security_violation" || a.focus_violations > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results"
        description={isStudent ? "Every quiz you've finished and how you did." : "Quiz scores across your centre, with flags for students who left the quiz screen."}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone="primary" icon={Target} label="Average score" value={avg === null ? "–" : `${Math.round(avg)}%`} hint={`${filtered.length} ${filtered.length === 1 ? "attempt" : "attempts"}`} />
        <StatCard icon={Trophy} label={isStudent ? "Best score" : "Top score"} value={best === null ? "–" : `${Math.round(best)}%`} tone="success" />
        <StatCard icon={AlertTriangle} label="Flagged attempts" value={flagged} hint="Left the quiz screen at least once" tone={flagged ? "warning" : "default"} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isStudent ? "Search quizzes" : "Search quiz or student"} className="pl-9" aria-label="Search results" />
        </div>
        {quizzes.length > 1 ? (
          <Select value={quizFilter} onValueChange={setQuizFilter}>
            <SelectTrigger className="sm:w-60" aria-label="Quiz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All quizzes</SelectItem>
              {quizzes.map(([id, title]) => (
                <SelectItem key={id} value={id}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title={attempts.length ? "Nothing matches" : "No results yet"}
          body={attempts.length ? "Try another search." : isStudent ? "Finish a quiz and your score shows here." : "Scores appear here as students finish quizzes."}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {filtered.map((a: AttemptDto) => (
            <li key={a.id} className="flex items-center gap-4 px-4 py-3">
              <ScoreRing score={a.score ?? 0} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{isStudent ? a.quiz_title : a.student_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isStudent ? null : `${a.quiz_title} · `}
                  {a.submitted_at
                    ? new Date(a.submitted_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : ""}
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Clock className="inline size-3" /> {Math.max(1, Math.round(a.time_spent_seconds / 60))} min
                  </span>
                </p>
              </div>
              <div className="hidden flex-col items-end gap-1 sm:flex">
                {a.status === "invalidated" ? (
                  <Badge tone="danger">Invalidated</Badge>
                ) : a.submitted_reason !== "manual" ? (
                  <Badge tone={a.submitted_reason === "security_violation" ? "danger" : "warning"}>{REASON[a.submitted_reason] ?? a.submitted_reason}</Badge>
                ) : null}
                {a.focus_violations > 0 ? (
                  <span className="text-xs text-warning">
                    Left screen {a.focus_violations}×
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
