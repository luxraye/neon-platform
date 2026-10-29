"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitQuizAttempt } from "./actions";

/** Questions arrive without the answer key; scoring happens on the server. */
type QuizQuestion = {
  question: string;
  options: string[];
};

type Quiz = {
  id: string;
  title: string;
  time_limit_minutes: number;
};

export function QuizTaker({
  quiz,
  questions,
  attemptId,
  maxFocusViolations,
  onClose,
}: {
  quiz: Quiz;
  questions: QuizQuestion[];
  attemptId: string;
  maxFocusViolations: number;
  onClose: () => void;
}) {
  const router = useRouter();
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
  const answeredCount = Object.keys(answers).length;
  const lowTime = secondsLeft <= 60;

  const exit = () => {
    if (submitted) return onClose();
    if (confirm("Leave the quiz? Your answers so far will be submitted.")) void handleSubmit("manual");
  };

  if (!questions.length) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">This quiz has no questions yet.</p>
        <Button variant="outline" onClick={onClose}>Back</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background select-none">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{quiz.title}</p>
            <p className="text-xs text-muted-foreground">
              {answeredCount} of {questions.length} answered
              {focusViolations > 0 ? (
                <span className="ml-2 font-semibold text-warning">
                  · Left screen {focusViolations}/{maxFocusViolations}
                </span>
              ) : null}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-mono text-sm font-bold tabular-nums",
              lowTime ? "animate-pulse bg-destructive text-white" : "bg-ink text-neon"
            )}
            aria-live="polite"
          >
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
          <Button variant="ghost" size="sm" onClick={exit}>
            <X /> Exit
          </Button>
        </div>
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <p className="text-sm font-semibold text-primary">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{q.question}</h1>
          <div className="mt-6 space-y-3" role="radiogroup">
            {q.options.map((opt, oIndex) => {
              const chosen = answers[currentIndex] === oIndex;
              return (
                <button
                  key={oIndex}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => ({ ...a, [currentIndex]: oIndex }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                    chosen ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                      chosen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {String.fromCharCode(65 + oIndex)}
                  </span>
                  <span className="text-[15px]">{opt || "(empty option)"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Question ${i + 1}`}
                className={cn(
                  "size-7 rounded-md text-xs font-semibold",
                  i === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : typeof answers[i] === "number"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
              <ChevronLeft /> Back
            </Button>
            {currentIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentIndex((i) => i + 1)}>
                Next <ChevronRight />
              </Button>
            ) : (
              <Button
                variant="neon"
                disabled={submitting}
                onClick={() => {
                  const missing = questions.length - answeredCount;
                  if (missing > 0 && !confirm(`${missing} ${missing === 1 ? "question is" : "questions are"} unanswered. Submit anyway?`)) return;
                  void handleSubmit("manual");
                }}
              >
                {submitting ? "Submitting…" : "Submit quiz"}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
