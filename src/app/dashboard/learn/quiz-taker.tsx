"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { createQuizResultNotification, submitQuizAttempt } from "./actions";

type MultipleChoiceQuestion = {
  type?: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
};

type QuizQuestion = MultipleChoiceQuestion;

type Quiz = {
  id: string;
  title: string;
  time_limit_minutes: number;
  questions: unknown;
};

export function QuizTaker({
  quiz,
  attemptId,
  maxFocusViolations,
  onClose,
}: {
  quiz: Quiz;
  attemptId: string;
  maxFocusViolations: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const questions = (Array.isArray(quiz.questions) ? quiz.questions : []) as unknown as QuizQuestion[];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(quiz.time_limit_minutes * 60);
  const [timeUp, setTimeUp] = useState(false);
  const [focusViolations, setFocusViolations] = useState(0);
  const [warned, setWarned] = useState(false);

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

  useEffect(() => {
    if (submitted) return;
    const preventDefault = (event: Event) => event.preventDefault();
    const blockKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["c", "v", "x", "a"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    document.addEventListener("copy", preventDefault);
    document.addEventListener("paste", preventDefault);
    document.addEventListener("cut", preventDefault);
    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("copy", preventDefault);
      document.removeEventListener("paste", preventDefault);
      document.removeEventListener("cut", preventDefault);
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [submitted]);

  useEffect(() => {
    if (submitted) return;
    const registerViolation = () => {
      setFocusViolations((prev) => prev + 1);
    };
    const onVisibility = () => {
      if (document.hidden) registerViolation();
    };
    const onBlur = () => registerViolation();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [submitted]);

  useEffect(() => {
    if (submitted) return;
    if (focusViolations <= 0) return;
    if (focusViolations >= maxFocusViolations) {
      toast.error("Security threshold reached. Quiz will now submit.");
      void handleSubmit("security_violation");
      return;
    }
    if (!warned) {
      setWarned(true);
      toast.warning(`Security warning: do not switch tabs/windows. Violations: ${focusViolations}/${maxFocusViolations}`);
    } else {
      toast.warning(`Focus violations: ${focusViolations}/${maxFocusViolations}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusViolations, maxFocusViolations, submitted]);

  const handleSubmit = async (reason: "manual" | "timer_expired" | "security_violation" = "manual") => {
    if (submitted) return;
    setSubmitted(true);
    setTimeUp(false);
    setSubmitting(true);

    const answerArray = questions.map((_, i) => (typeof answers[i] === "number" ? answers[i] : -1));
    const result = await submitQuizAttempt({
      attemptId,
      answers: answerArray,
      focusViolations,
      submittedReason: reason,
    });

    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    // Create an in-app notification (service role on the server).
    try {
      await createQuizResultNotification({ quizTitle: quiz.title, score: result.score });
    } catch {
      // ignore notification failures; quiz attempt is the source of truth
    }
    toast.success(`Submitted. Score: ${result.score.toFixed(0)}%`);
    onClose();
    router.refresh();
  };

  useEffect(() => {
    if (timeUp && !submitted) {
      void handleSubmit("timer_expired");
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
          {(q as MultipleChoiceQuestion).options.map((opt, oIndex) => (
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
          ))}
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
          <Button onClick={() => void handleSubmit("manual")} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );
}
