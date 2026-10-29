"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, HelpCircle, Lock, Timer } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { qAttempts, qQuizzes, type QuizSummaryDto } from "@/app/data/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, EmptyState, PageHeader } from "@/components/ui/page";
import { MaterialsLibrary } from "@/components/materials/materials-library";
import { QuizTaker } from "./quiz-taker";
import { startQuizAttempt } from "./actions";

type Tab = "quizzes" | "materials";

export default function LearnPage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useProfile();
  const cohortId = me?.profile?.cohort_id ?? null;
  const isStudent = me?.profile?.role === "student";
  const [tab, setTab] = useState<Tab>("quizzes");

  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["learn", "quizzes", cohortId ?? ""],
    queryFn: () => qQuizzes(),
    enabled: !!cohortId,
  });
  const { data: attempts } = useQuery({
    queryKey: ["results-attempts"],
    queryFn: () => qAttempts(),
    enabled: !!cohortId,
  });
  const bestScore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of attempts ?? []) {
      if (a.status === "in_progress") continue;
      m[a.quiz_id] = Math.max(m[a.quiz_id] ?? 0, Number(a.score ?? 0));
    }
    return m;
  }, [attempts]);

  const [selected, setSelected] = useState<QuizSummaryDto | null>(null);
  const [password, setPassword] = useState("");
  const [starting, setStarting] = useState(false);
  const [attempt, setAttempt] = useState<{ id: string; questions: { question: string; options: string[] }[] } | null>(null);

  async function start() {
    if (!selected) return;
    setStarting(true);
    const res = await startQuizAttempt({ quizId: selected.id, password });
    setStarting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {
      // Some phones don't allow full screen; the quiz still works.
    }
    setAttempt({ id: res.attemptId, questions: res.questions });
    setPassword("");
  }

  function close() {
    setAttempt(null);
    setSelected(null);
    setPassword("");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["results-attempts"] });
  }

  if (meLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!isStudent || !cohortId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Learn" />
        <EmptyState
          icon={BookOpen}
          title={isStudent ? "Not in a class yet" : "For students"}
          body={isStudent ? "Your centre will place you in a cohort, then your materials and quizzes appear here." : "Manage content from Materials and Quizzes."}
        />
      </div>
    );
  }

  const todo = (quizzes ?? []).filter((q) => bestScore[q.id] === undefined);
  const done = (quizzes ?? []).filter((q) => bestScore[q.id] !== undefined);

  return (
    <div className="space-y-6">
      <PageHeader title="Learn" description="Your quizzes and study materials." />

      <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist">
        {(
          [
            ["quizzes", `Quizzes${todo.length ? ` · ${todo.length} to do` : ""}`],
            ["materials", "Materials"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold",
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "materials" ? (
        <MaterialsLibrary embedded />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !quizzes?.length ? (
        <EmptyState icon={ClipboardList} title="No quizzes yet" body="When a tutor sets a quiz for your class it shows up here." />
      ) : (
        <div className="space-y-6">
          {[
            ["To do", todo],
            ["Done", done],
          ].map(([heading, list]) =>
            (list as QuizSummaryDto[]).length ? (
              <section key={heading as string}>
                <h2 className="mb-3 text-sm font-bold text-muted-foreground">{heading as string}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(list as QuizSummaryDto[]).map((q) => {
                    const score = bestScore[q.id];
                    const due = q.due_at ? new Date(q.due_at) : null;
                    const closed = due ? due.getTime() < Date.now() : false;
                    return (
                      <article key={q.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-bold leading-snug">{q.title}</h3>
                          {score !== undefined ? (
                            <Badge tone={score >= 50 ? "success" : "danger"}>
                              <CheckCircle2 className="size-3" /> {Math.round(score)}%
                            </Badge>
                          ) : due ? (
                            <Badge tone={closed ? "default" : "warning"}>
                              <CalendarClock className="size-3" />
                              {closed ? "Closed" : due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <HelpCircle className="size-4" /> {q.question_count} questions
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Timer className="size-4" /> {q.time_limit_minutes} min
                          </span>
                        </div>
                        <div className="mt-4">
                          <Button
                            className="w-full"
                            variant={score !== undefined ? "outline" : "default"}
                            disabled={closed && score === undefined}
                            onClick={() => setSelected(q)}
                          >
                            {score !== undefined ? "Try again" : closed ? "Closed" : "Start quiz"}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}

      <Dialog open={!!selected && !attempt} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected?.question_count} questions, {selected?.time_limit_minutes} minutes. The timer starts as soon as you begin. Leaving the
              quiz screen {selected?.max_focus_violations} times submits it automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="quiz-pw" className="flex items-center gap-1.5">
                <Lock className="size-3.5" /> Quiz password from your tutor
              </Label>
              <Input id="quiz-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Not now
              </Button>
              <Button type="submit" disabled={!password || starting}>
                {starting ? "Starting…" : "Begin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selected && attempt ? (
        <QuizTaker
          quiz={{ id: selected.id, title: selected.title, time_limit_minutes: selected.time_limit_minutes }}
          questions={attempt.questions}
          attemptId={attempt.id}
          maxFocusViolations={selected.max_focus_violations}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
