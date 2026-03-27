"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQuiz } from "./../actions";

type McQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export default function NewQuizPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile();
  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    null;
  const quizzesHref = pathname.startsWith("/tutor") ? "/tutor/quizzes" : "/dashboard/quizzes";
  const { data: cohorts } = useCohorts(institutionId);

  const [title, setTitle] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [accessPassword, setAccessPassword] = useState("");
  const [maxFocusViolations, setMaxFocusViolations] = useState(2);
  const [questions, setQuestions] = useState<McQuestion[]>([
    { question: "", options: ["", "", ""], correctIndex: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addQuestion = () => {
    setQuestions((q) => [...q, { question: "", options: ["", "", ""], correctIndex: 0 }]);
  };

  const updateQuestion = (qIndex: number, patch: Partial<McQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)));
  };

  const setOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const nextOptions = [...q.options];
        nextOptions[oIndex] = value;
        return { ...q, options: nextOptions };
      })
    );
  };

  const addOption = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q))
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((q) => q.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = questions.every((q) => {
      if (!q.question.trim()) return false;
      const cleanOptions = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (cleanOptions.length < 2) return false;
      const correctOption = q.options[q.correctIndex]?.trim();
      if (!correctOption) return false;
      return cleanOptions.includes(correctOption);
    });
    if (!valid) {
      toast.error("Each question needs text, at least two filled options, and a selected correct answer.");
      return;
    }

    const normalizedQuestions = questions.map((q) => {
      const cleanOptions = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
      const correctOption = q.options[q.correctIndex]?.trim() ?? "";
      return {
        type: "multiple_choice" as const,
        question: q.question.trim(),
        options: cleanOptions,
        correctIndex: cleanOptions.indexOf(correctOption),
      };
    });

    setSubmitting(true);
    const result = await createQuiz({
      title,
      cohort_id: cohortId || undefined,
      time_limit_minutes: timeLimit,
      access_password: accessPassword,
      security_mode: "medium",
      max_focus_violations: maxFocusViolations,
      questions: normalizedQuestions,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Quiz created.");
      queryClient.invalidateQueries({ queryKey: ["quizzes", institutionId ?? ""] });
      router.push(quizzesHref);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={quizzesHref}>← Quizzes</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold mb-2">New quiz</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        Multiple choice only. Students see a countdown for the time limit you set below when they take the quiz.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="quiz-title">Title</Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Week 1 Quiz"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Cohort</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select cohort" />
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
        <div className="space-y-2">
          <Label htmlFor="quiz-time">Time limit (minutes)</Label>
          <Input
            id="quiz-time"
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value) || 30)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-password">Quiz password</Label>
          <Input
            id="quiz-password"
            type="password"
            value={accessPassword}
            onChange={(e) => setAccessPassword(e.target.value)}
            placeholder="Required to start quiz"
            minLength={6}
            required
          />
          <p className="text-xs text-muted-foreground">
            Share this password with students only when invigilated.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-violations">Auto-submit after focus violations</Label>
          <Input
            id="focus-violations"
            type="number"
            min={1}
            max={10}
            value={maxFocusViolations}
            onChange={(e) => setMaxFocusViolations(Math.min(10, Math.max(1, Number(e.target.value) || 2)))}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Questions (multiple choice)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              Add question
            </Button>
          </div>
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="rounded-lg border p-4 space-y-3 bg-card">
              <div className="flex justify-between items-start gap-2">
                <Label className="text-sm">Question {qIndex + 1}</Label>
                {questions.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)}>
                    Remove
                  </Button>
                )}
              </div>

              <Input
                value={q.question}
                onChange={(e) => updateQuestion(qIndex, { question: e.target.value })}
                placeholder="Question text"
                required
              />

              <div className="space-y-2 pl-2">
                <span className="text-xs text-muted-foreground">Options (select correct)</span>
                {q.options.map((opt, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`q-${qIndex}-correct`}
                      checked={q.correctIndex === oIndex}
                      onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                    />
                    <Input
                      value={opt}
                      onChange={(e) => setOption(qIndex, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                    />
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => addOption(qIndex)}>
                  + Option
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create quiz"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={quizzesHref}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
