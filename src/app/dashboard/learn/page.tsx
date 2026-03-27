"use client";

import { useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuizTaker } from "./quiz-taker";
import { startQuizAttempt } from "./actions";

type Material = {
  id: string;
  title: string;
  content_url: string | null;
  description: string | null;
  subject: string | null;
};

type Quiz = {
  id: string;
  title: string;
  time_limit_minutes: number;
  questions: unknown;
  max_focus_violations: number;
};

function useCohortMaterials(cohortId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["learn", "materials", cohortId ?? ""],
    queryFn: async (): Promise<Material[]> => {
      if (!cohortId) return [];
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, content_url, description, subject")
        .eq("cohort_id", cohortId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Material[];
    },
    enabled: !!cohortId,
  });
}

function useCohortQuizzes(cohortId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["learn", "quizzes", cohortId ?? ""],
    queryFn: async (): Promise<Quiz[]> => {
      if (!cohortId) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, time_limit_minutes, questions, max_focus_violations")
        .eq("cohort_id", cohortId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Quiz[];
    },
    enabled: !!cohortId,
  });
}

export default function LearnPage() {
  const { data: profileData } = useProfile();
  const cohortId = profileData?.profile?.cohort_id ?? null;
  const { data: materials, isLoading: materialsLoading } = useCohortMaterials(cohortId);
  const { data: quizzes, isLoading: quizzesLoading } = useCohortQuizzes(cohortId);
  const [takingQuizId, setTakingQuizId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);

  if (!profileData?.profile) {
    return (
      <div className="px-2 sm:px-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2">Learn</h1>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (profileData.profile.role !== "student") {
    return (
      <div className="px-2 sm:px-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2">Learn</h1>
        <p className="text-muted-foreground text-sm">This page is for students. Go to Materials or Quizzes to manage content.</p>
      </div>
    );
  }

  if (!cohortId) {
    return (
      <div className="px-2 sm:px-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-2">Learn</h1>
        <p className="text-muted-foreground text-sm">
          You’re not assigned to a cohort yet. A headmaster will assign you so you can access materials and quizzes.
        </p>
      </div>
    );
  }

  const quiz = takingQuizId && quizzes?.find((q) => q.id === takingQuizId);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      toast.warning("Could not enter full-screen. Continue without full-screen.");
    }
  };

  const handleStartQuiz = async () => {
    if (!takingQuizId) return;
    setStartingQuizId(takingQuizId);
    const result = await startQuizAttempt({ quizId: takingQuizId, password });
    setStartingQuizId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    await requestFullscreen();
    setAttemptId(result.attemptId);
    setPassword("");
  };

  return (
    <>
      <div className="min-h-0 w-full px-2 sm:px-4 pb-6">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Learn</h1>

        <section className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-medium mb-2 sm:mb-3">Materials</h2>
          {materialsLoading && <p className="text-muted-foreground text-sm">Loading materials…</p>}
          {!materialsLoading && (!materials?.length ? (
            <p className="text-muted-foreground text-sm">No materials for your cohort yet.</p>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {materials?.map((m) => (
                <Card key={m.id} className="touch-manipulation">
                  <CardHeader className="pb-2 px-4 sm:px-6">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    {m.subject && (
                      <CardDescription>{m.subject}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    {m.description && (
                      <p className="text-sm text-muted-foreground mb-2">{m.description}</p>
                    )}
                    {m.content_url ? (
                      <Button asChild size="sm" className="min-h-10">
                        <a href={m.content_url} target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">No link</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-base sm:text-lg font-medium mb-2 sm:mb-3">Quizzes</h2>
          {quizzesLoading && <p className="text-muted-foreground text-sm">Loading quizzes…</p>}
          {!quizzesLoading && (!quizzes?.length ? (
            <p className="text-muted-foreground text-sm">No quizzes for your cohort yet.</p>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {quizzes?.map((q) => (
                <Card key={q.id} className="touch-manipulation">
                  <CardHeader className="pb-2 px-4 sm:px-6">
                    <CardTitle className="text-base">{q.title}</CardTitle>
                    <CardDescription>
                      {q.time_limit_minutes} min · Medium security
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <Button size="sm" className="min-h-10" onClick={() => setTakingQuizId(q.id)}>
                      Take quiz
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </section>
      </div>

      <Dialog open={!!takingQuizId} onOpenChange={(open) => {
        if (!open) {
          setTakingQuizId(null);
          setAttemptId(null);
          setPassword("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {!quiz || !takingQuizId ? null : !attemptId ? (
            <>
              <DialogHeader>
                <DialogTitle>Start quiz: {quiz.title}</DialogTitle>
                <DialogDescription>
                  Enter the tutor password to begin. Quiz opens in secure mode with countdown and focus monitoring.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="quiz-access-password">Quiz password</Label>
                <Input
                  id="quiz-access-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter quiz password"
                  minLength={6}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStartQuiz} disabled={!password || startingQuizId === takingQuizId}>
                  {startingQuizId === takingQuizId ? "Starting…" : "Start now"}
                </Button>
              </div>
            </>
          ) : (
            <QuizTaker
              quiz={quiz}
              attemptId={attemptId}
              maxFocusViolations={quiz.max_focus_violations}
              onClose={() => {
                setTakingQuizId(null);
                setAttemptId(null);
                setPassword("");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
