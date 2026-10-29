"use server";

import { scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { getActor } from "@/lib/auth/identity";
import { notifyUser } from "@/lib/notify-dispatch";

type MultipleChoiceQuestion = {
  type?: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
};

type QuizSecurityMode = "light" | "medium" | "strict";

type QuizRow = {
  id: string;
  title: string;
  institution_id: string;
  cohort_id: string | null;
  time_limit_minutes: number;
  questions: unknown;
  access_password_hash: string;
  security_mode: QuizSecurityMode;
  max_focus_violations: number;
};

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, storedDigest] = storedHash.split(":");
  if (!salt || !storedDigest) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const storedBuffer = Buffer.from(storedDigest, "hex");
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, storedBuffer);
}

function normalizeMultipleChoiceQuestions(raw: unknown): MultipleChoiceQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item as MultipleChoiceQuestion)
    .filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        typeof q.correctIndex === "number" &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
    );
}

export async function startQuizAttempt(input: { quizId: string; password: string }) {
  const identity = await getActor(["student"]);
  if (!identity?.institution_id) {
    return { success: false as const, error: "Only students can start quiz attempts." };
  }

  const admin = getDb();
  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select(
      "id, title, institution_id, cohort_id, time_limit_minutes, questions, access_password_hash, security_mode, max_focus_violations"
    )
    .eq("id", input.quizId)
    .maybeSingle();
  if (quizError || !quiz) {
    return { success: false as const, error: quizError?.message ?? "Quiz not found." };
  }
  const quizRow = quiz as QuizRow;
  if (quizRow.institution_id !== identity.institution_id) {
    return { success: false as const, error: "You cannot take this quiz." };
  }
  const studentCohortId = identity.profile?.cohort_id ?? null;
  if (quizRow.cohort_id && quizRow.cohort_id !== studentCohortId) {
    return { success: false as const, error: "This quiz is not for your cohort." };
  }
  if (quizRow.access_password_hash && !verifyPassword(input.password ?? "", quizRow.access_password_hash)) {
    return { success: false as const, error: "Incorrect quiz password." };
  }

  const questionSnapshot = normalizeMultipleChoiceQuestions(quizRow.questions);
  if (!questionSnapshot.length) {
    return { success: false as const, error: "Quiz has no valid questions." };
  }

  const { data: attempt, error: attemptError } = await admin
    .from("quiz_attempts")
    .insert({
      quiz_id: quizRow.id,
      student_id: identity.user.id,
      answers: [],
      question_snapshot: questionSnapshot,
      status: "in_progress",
      submitted_reason: "manual",
      focus_violations: 0,
      time_spent_seconds: 0,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select("id, started_at")
    .single();

  if (attemptError || !attempt) {
    return { success: false as const, error: attemptError?.message ?? "Could not start quiz." };
  }

  return {
    success: true as const,
    attemptId: attempt.id as string,
    startedAt: attempt.started_at as string,
    // Questions go to the browser without the answer key.
    questions: questionSnapshot.map((q) => ({ question: q.question, options: q.options })),
    securityMode: quizRow.security_mode,
    maxFocusViolations: quizRow.max_focus_violations,
    timeLimitMinutes: quizRow.time_limit_minutes,
  };
}

export async function submitQuizAttempt(input: {
  attemptId: string;
  answers: Array<number>;
  focusViolations: number;
  submittedReason: "manual" | "timer_expired" | "security_violation";
}) {
  const identity = await getActor(["student"]);
  if (!identity) {
    return { success: false as const, error: "Not authenticated." };
  }

  const admin = getDb();
  const { data: attempt, error: attemptError } = await admin
    .from("quiz_attempts")
    .select("id, quiz_id, student_id, started_at, status, question_snapshot")
    .eq("id", input.attemptId)
    .maybeSingle();
  if (attemptError || !attempt) {
    return { success: false as const, error: attemptError?.message ?? "Attempt not found." };
  }
  if ((attempt.student_id as string) !== identity.user.id) {
    return { success: false as const, error: "You cannot submit this attempt." };
  }
  if ((attempt.status as string) !== "in_progress") {
    return { success: false as const, error: "This attempt is already submitted." };
  }

  const questionSnapshot = normalizeMultipleChoiceQuestions(attempt.question_snapshot);
  if (!questionSnapshot.length) {
    return { success: false as const, error: "Invalid question snapshot." };
  }

  const normalizedAnswers = questionSnapshot.map((_, idx) => {
    const answer = input.answers[idx];
    return typeof answer === "number" && Number.isInteger(answer) ? answer : -1;
  });
  let correct = 0;
  questionSnapshot.forEach((q, idx) => {
    if (normalizedAnswers[idx] === q.correctIndex) {
      correct += 1;
    }
  });
  const score = questionSnapshot.length ? (correct / questionSnapshot.length) * 100 : 0;

  const startedAt = new Date(attempt.started_at as string).getTime();
  const now = Date.now();
  const timeSpentSeconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.round((now - startedAt) / 1000))
    : 0;
  // The timer is enforced here too: a late manual submit is recorded as timer_expired.
  const { data: quizMeta } = await admin
    .from("quizzes")
    .select("title, time_limit_minutes")
    .eq("id", attempt.quiz_id as string)
    .maybeSingle();
  const limitSeconds = Number(quizMeta?.time_limit_minutes ?? 0) * 60;
  const GRACE_SECONDS = 60;
  const lateSubmit = limitSeconds > 0 && timeSpentSeconds > limitSeconds + GRACE_SECONDS;
  const submittedReason = lateSubmit && input.submittedReason === "manual" ? "timer_expired" : input.submittedReason;
  const status = submittedReason === "manual" ? "submitted" : "auto_submitted";

  const { error: updateError } = await admin
    .from("quiz_attempts")
    .update({
      answers: normalizedAnswers,
      score,
      ended_at: new Date(now).toISOString(),
      focus_violations: Math.min(1000, Math.max(0, Math.floor(input.focusViolations || 0))),
      time_spent_seconds: timeSpentSeconds,
      submitted_reason: submittedReason,
      status,
      submitted_at: new Date(now).toISOString(),
    })
    .eq("id", input.attemptId)
    .eq("status", "in_progress");

  if (updateError) {
    return { success: false as const, error: updateError.message };
  }

  try {
    await notifyUser(
      identity.user.id,
      null,
      "Quiz result",
      `You scored ${score.toFixed(0)}% in ${quizMeta?.title ?? "your quiz"}.`,
      "quiz_result"
    );
  } catch (e) {
    console.error("[submitQuizAttempt] notify", e);
  }

  return {
    success: true as const,
    score,
    correct,
    total: questionSnapshot.length,
  };
}

