"use server";

import { randomBytes, scryptSync } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { getActor } from "@/lib/auth/identity";
import { cohortBelongsTo } from "@/lib/server/guards";
import { broadcastNewQuizToStudents } from "@/lib/notify-dispatch";

export type QuizQuestion = {
  type: "multiple_choice";
  question: string;
  options?: string[];
  correctIndex?: number;
};

export type CreateQuizResult =
  | { success: true }
  | { success: false; error: string };

function hashQuizPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export async function createQuiz(formData: {
  title: string;
  questions: QuizQuestion[];
  time_limit_minutes?: number;
  cohort_id?: string;
  access_password?: string;
  security_mode?: "light" | "medium" | "strict";
  max_focus_violations?: number;
  /** Optional YYYY-MM-DD — reminders use cron + email. */
  due_at?: string | null;
}): Promise<CreateQuizResult> {
  const identity = await getActor(["headmaster", "tutor"]);
  if (!identity?.institution_id) {
    return { success: false, error: "Only tutors and headmasters can create quizzes." };
  }

  const title = formData.title?.trim();
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  if (!Array.isArray(formData.questions) || formData.questions.length === 0) {
    return { success: false, error: "At least one question is required." };
  }
  const accessPassword = (formData.access_password ?? "").trim();
  if (accessPassword.length < 6) {
    return { success: false, error: "Quiz password must be at least 6 characters." };
  }

  for (const q of formData.questions) {
    const t = q.type ?? "multiple_choice";
    if (t !== "multiple_choice") {
      return { success: false, error: "Only multiple-choice questions are supported." };
    }
  }

  // Validate and normalize question payloads so quiz-taker can render reliably.
  const normalizedQuestions = formData.questions.map((q) => {
    const options = (q.options ?? []).map((o) => o.trim()).filter((o) => o.length > 0);
    return {
      type: "multiple_choice" as const,
      question: q.question?.trim() ?? "",
      options,
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    };
  });

  for (const q of normalizedQuestions) {
    if (!q.question) return { success: false, error: "Question text is required." };
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { success: false, error: "Multiple choice needs at least 2 non-empty options." };
    }
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return { success: false, error: "Choose a valid correct option for multiple choice." };
    }
  }

  const admin = getDb();
  const securityMode = formData.security_mode ?? "medium";
  const maxFocusViolations = Math.min(10, Math.max(1, formData.max_focus_violations ?? 2));
  const cohortId = formData.cohort_id?.trim() || null;
  if (!(await cohortBelongsTo(cohortId, identity.institution_id))) {
    return { success: false, error: "That cohort is not in your centre." };
  }
  if (normalizedQuestions.length > 200) {
    return { success: false, error: "A quiz can have at most 200 questions." };
  }
  const timeLimit = Math.min(300, Math.max(1, Math.floor(formData.time_limit_minutes ?? 30)));
  const dueRaw = formData.due_at?.trim();
  // Accepts a full ISO timestamp (end of the chosen day, from the browser) or a bare date.
  const dueParsed = dueRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? `${dueRaw}T23:59:59Z` : dueRaw) : null;
  const dueAt = dueParsed && !Number.isNaN(dueParsed.getTime()) ? dueParsed.toISOString() : null;

  const { error } = await admin.from("quizzes").insert({
    institution_id: identity.institution_id,
    cohort_id: cohortId,
    title,
    questions: normalizedQuestions as unknown,
    time_limit_minutes: timeLimit,
    access_password_hash: hashQuizPassword(accessPassword),
    security_mode: securityMode,
    max_focus_violations: maxFocusViolations,
    due_at: dueAt,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (cohortId) {
    try {
      await broadcastNewQuizToStudents(identity.institution_id, cohortId, title, dueAt);
    } catch (e) {
      console.error("[createQuiz] notify students", e);
    }
  }

  return { success: true };
}
