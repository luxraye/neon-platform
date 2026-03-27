"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { createQuizResultNotification } from "./actions";

type MultipleChoiceQuestion = {
  type?: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
};

type ShortTextQuestion = {
  type: "short_text";
  question: string;
  answer: string;
};

type QuizQuestion = MultipleChoiceQuestion | ShortTextQuestion;

type Quiz = {
  id: string;
  title: string;
  time_limit_minutes: number;
  questions: unknown;
};

export function QuizTaker({
  quiz,
  onClose,
}: {
  quiz: Quiz;
  onClose: () => void;
}) {
  const router = useRouter();
  const questions = (Array.isArray(quiz.questions) ? quiz.questions : []) as unknown as QuizQuestion[];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(quiz.time_limit_minutes * 60);
  const [timeUp, setTimeUp] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setTimeUp(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [submitted]);

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    setTimeUp(false);
    setSubmitting(true);

    const supabase = createBrowserSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in.");
      setSubmitting(false);
      return;
    }

    const answerArray = questions.map((q, i) => {
      if (q && "type" in q && q.type === "short_text") {
        return typeof answers[i] === "string" ? answers[i] : "";
      }
      return typeof answers[i] === "number" ? answers[i] : -1;
    });

    const normalize = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    let correct = 0;
    questions.forEach((q, i) => {
      if (q && "type" in q && q.type === "short_text") {
        const expected = normalize((q as ShortTextQuestion).answer ?? "");
        const given = normalize(String(answerArray[i] ?? ""));
        if (expected && given && expected === given) correct++;
        return;
      }

      const mc = q as MultipleChoiceQuestion;
      if (answerArray[i] === mc.correctIndex) correct++;
    });
    const score = questions.length ? (correct / questions.length) * 100 : 0;

    const { error } = await supabase.from("quiz_attempts").insert({
      quiz_id: quiz.id,
      student_id: user.id,
      answers: answerArray,
      score,
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Create an in-app notification (service role on the server).
    try {
      await createQuizResultNotification({ quizTitle: quiz.title, score });
    } catch {
      // ignore notification failures; quiz attempt is the source of truth
    }
    toast.success(`Submitted. Score: ${score.toFixed(0)}%`);
    onClose();
    router.refresh();
  };

  useEffect(() => {
    if (timeUp && !submitted) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when timeUp, handleSubmit is stable enough
  }, [timeUp]);

  const q = questions[currentIndex];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  if (!questions.length) {
    return (
      <div>
        <p className="text-muted-foreground">No questions in this quiz.</p>
        <Button variant="outline" onClick={onClose} className="mt-4">Back</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
            {!submitted && ` · Time left: ${mins}:${secs.toString().padStart(2, "0")}`}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>Exit</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {"type" in q && q.type === "short_text" ? (
            <div className="space-y-2">
              <Label htmlFor={`answer-${currentIndex}`}>Your answer</Label>
              <Input
                id={`answer-${currentIndex}`}
                value={typeof answers[currentIndex] === "string" ? (answers[currentIndex] as string) : ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [currentIndex]: e.target.value }))}
                disabled={submitted}
                placeholder="Type your answer"
              />
            </div>
          ) : (
            (q as MultipleChoiceQuestion).options.map((opt, oIndex) => (
              <label
                key={oIndex}
                className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                  answers[currentIndex] === oIndex
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  checked={answers[currentIndex] === oIndex}
                  onChange={() => setAnswers((a) => ({ ...a, [currentIndex]: oIndex }))}
                  disabled={submitted}
                  className="sr-only"
                />
                <span>{opt || "(empty option)"}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => i + 1)}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
