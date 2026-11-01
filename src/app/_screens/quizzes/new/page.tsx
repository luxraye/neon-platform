"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Plus, Trash2, X } from "lucide-react";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { roleRoot } from "@/lib/role-root";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/ui/page";
import { createQuiz } from "../actions";

type McQuestion = { question: string; options: string[]; correctIndex: number };
const blank = (): McQuestion => ({ question: "", options: ["", "", "", ""], correctIndex: 0 });

function isComplete(q: McQuestion) {
  const filled = q.options.filter((o) => o.trim());
  return !!q.question.trim() && filled.length >= 2 && !!q.options[q.correctIndex]?.trim();
}

export default function NewQuizPage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { role, profileData } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const back = `${roleRoot(role, pathname)}/quizzes`;

  const [title, setTitle] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [timeLimit, setTimeLimit] = useState(20);
  const [password, setPassword] = useState("");
  const [maxViolations, setMaxViolations] = useState(2);
  const [dueDate, setDueDate] = useState("");
  const [questions, setQuestions] = useState<McQuestion[]>([blank()]);
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, patch: Partial<McQuestion>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const setOption = (i: number, o: number, value: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, options: q.options.map((x, j) => (j === o ? value : x)) } : q)));
  const removeOption = (i: number, o: number) =>
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== i || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== o);
        const correctIndex = q.correctIndex === o ? 0 : q.correctIndex > o ? q.correctIndex - 1 : q.correctIndex;
        return { ...q, options, correctIndex };
      })
    );

  const completeCount = questions.filter(isComplete).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = questions.findIndex((q) => !isComplete(q));
    if (bad >= 0) {
      toast.error(`Question ${bad + 1} needs text, two answers and a correct answer marked.`);
      document.getElementById(`q-${bad}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const normalized = questions.map((q) => {
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      return {
        type: "multiple_choice" as const,
        question: q.question.trim(),
        options,
        correctIndex: options.indexOf(q.options[q.correctIndex].trim()),
      };
    });
    setSubmitting(true);
    const res = await createQuiz({
      title,
      cohort_id: cohortId || undefined,
      time_limit_minutes: timeLimit,
      access_password: password,
      security_mode: "medium",
      max_focus_violations: maxViolations,
      // The quiz stays open until the end of the chosen day, in the tutor's timezone.
      due_at: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
      questions: normalized,
    });
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Quiz published. Students in that cohort can see it now.");
    queryClient.invalidateQueries({ queryKey: ["quizzes"] });
    router.push(back);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Quizzes
      </Link>
      <PageHeader title="New quiz" description="Multiple choice, timed, with a password you give students in class." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {questions.map((q, i) => (
            <section id={`q-${i}`} key={i} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <span className={cn("flex size-6 items-center justify-center rounded-md text-xs", isComplete(q) ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>
                    {isComplete(q) ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  Question {i + 1}
                </p>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate question" onClick={() => setQuestions((p) => [...p.slice(0, i + 1), { ...q, options: [...q.options] }, ...p.slice(i + 1)])}>
                    <Copy />
                  </Button>
                  {questions.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon-sm" className="hover:text-destructive" aria-label="Delete question" onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </div>
              <Textarea
                value={q.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="Type the question"
                className="min-h-16"
                aria-label={`Question ${i + 1} text`}
              />
              <p className="mb-2 mt-4 text-xs text-muted-foreground">Answers. Tap the letter of the correct one.</p>
              <div className="space-y-2">
                {q.options.map((opt, o) => {
                  const correct = q.correctIndex === o;
                  return (
                    <div key={o} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => update(i, { correctIndex: o })}
                        aria-label={`Mark answer ${String.fromCharCode(65 + o)} correct`}
                        aria-pressed={correct}
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors",
                          correct ? "border-success bg-success text-success-foreground" : "border-border text-muted-foreground hover:border-success/50"
                        )}
                      >
                        {correct ? <Check className="size-4" /> : String.fromCharCode(65 + o)}
                      </button>
                      <Input value={opt} onChange={(e) => setOption(i, o, e.target.value)} placeholder={`Answer ${String.fromCharCode(65 + o)}`} />
                      {q.options.length > 2 ? (
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove answer" onClick={() => removeOption(i, o)}>
                          <X />
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {q.options.length < 6 ? (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => update(i, { options: [...q.options, ""] })}>
                  <Plus /> Answer
                </Button>
              ) : null}
            </section>
          ))}
          <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setQuestions((p) => [...p, blank()])}>
            <Plus /> Add question
          </Button>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel title="Quiz settings">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quiz-title">Title</Label>
                <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3: Fractions" required />
              </div>
              <div className="space-y-2">
                <Label>Cohort</Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quiz-time">Minutes</Label>
                  <Input id="quiz-time" type="number" min={1} max={300} value={timeLimit} onChange={(e) => setTimeLimit(Math.max(1, Number(e.target.value) || 20))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-due">Closes</Label>
                  <Input id="quiz-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiz-pw">Password</Label>
                <Input id="quiz-pw" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required />
                <p className="text-xs text-muted-foreground">Write it on the board when the quiz starts.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiz-viol">Auto-submit after leaving the screen</Label>
                <Select value={String(maxViolations)} onValueChange={(v) => setMaxViolations(Number(v))}>
                  <SelectTrigger id="quiz-viol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "time" : "times"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="text-sm text-white/70">Ready</p>
            <p className="mt-1 text-2xl font-extrabold">
              {completeCount}/{questions.length} <span className="text-base font-semibold text-white/70">questions</span>
            </p>
            <Button type="submit" variant="neon" className="mt-4 w-full" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish quiz"}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
