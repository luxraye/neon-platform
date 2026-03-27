"use server";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

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

function verifyQuizPassword(password: string, storedHash: string): boolean {
  const [salt, storedDigest] = storedHash.split(":");
  if (!salt || !storedDigest) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derived, "hex");
  const storedBuffer = Buffer.from(storedDigest, "hex");
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedBuffer, storedBuffer);
}

export async function createQuiz(formData: {
  title: string;
  questions: QuizQuestion[];
  time_limit_minutes?: number;
  cohort_id?: string;
  access_password?: string;
  security_mode?: "light" | "medium" | "strict";
  max_focus_violations?: number;
}): Promise<CreateQuizResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  if (!identity.institution_id || (identity.role !== "headmaster" && identity.role !== "tutor")) {
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

  const admin = createServiceRoleClient();
  const securityMode = formData.security_mode ?? "medium";
  const maxFocusViolations = Math.min(10, Math.max(1, formData.max_focus_violations ?? 2));
  const { error } = await admin.from("quizzes").insert({
    institution_id: identity.institution_id,
    cohort_id: formData.cohort_id?.trim() || null,
    title,
    questions: normalizedQuestions as unknown,
    time_limit_minutes: formData.time_limit_minutes ?? 30,
    access_password_hash: hashQuizPassword(accessPassword),
    security_mode: securityMode,
    max_focus_violations: maxFocusViolations,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
