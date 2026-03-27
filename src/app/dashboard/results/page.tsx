"use client";

import { useMemo, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AttemptRow = {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number | null;
  status: "in_progress" | "submitted" | "auto_submitted" | "invalidated";
  submitted_reason: "manual" | "timer_expired" | "security_violation";
  focus_violations: number;
  time_spent_seconds: number;
  submitted_at: string;
};

type QuizRow = {
  id: string;
  title: string;
};

function useAttempts(role: string | null, userId: string | null, institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["results-attempts", role ?? "", userId ?? "", institutionId ?? ""],
    queryFn: async (): Promise<AttemptRow[]> => {
      if (!role || !userId) return [];
      let query = supabase
        .from("quiz_attempts")
        .select("id, quiz_id, student_id, score, status, submitted_reason, focus_violations, time_spent_seconds, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(300);

      if (role === "student") {
        query = query.eq("student_id", userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AttemptRow[];
    },
    enabled: !!role && !!userId && (!!institutionId || role === "student"),
  });
}

function useQuizTitles(quizIds: string[]) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["results-quiz-titles", quizIds.join(",")],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!quizIds.length) return {};
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as QuizRow[] | null)?.forEach((q) => {
        map[q.id] = q.title;
      });
      return map;
    },
    enabled: quizIds.length > 0,
  });
}

export default function ResultsPage() {
  const { data: profileData } = useProfile();
  const role = (profileData?.profile?.role ?? null) as string | null;
  const userId = profileData?.user?.id ?? null;
  const institutionId = profileData?.profile?.institution_id ?? null;
  const [search, setSearch] = useState("");

  const { data: attempts, isLoading } = useAttempts(role, userId, institutionId);
  const quizIds = useMemo(
    () => [...new Set((attempts ?? []).map((a) => a.quiz_id))],
    [attempts]
  );
  const { data: titleByQuiz } = useQuizTitles(quizIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attempts ?? [];
    return (attempts ?? []).filter((a) =>
      (titleByQuiz?.[a.quiz_id] ?? "Quiz").toLowerCase().includes(q)
    );
  }, [attempts, search, titleByQuiz]);

  const avgScore =
    filtered.length > 0
      ? filtered.reduce((sum, a) => sum + (a.score ?? 0), 0) / filtered.length
      : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === "student"
            ? "Your quiz attempts, scores, and submission details."
            : "Institution quiz attempts with integrity indicators for invigilation."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total attempts</CardDescription>
            <CardTitle className="text-2xl">{filtered.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average score</CardDescription>
            <CardTitle className="text-2xl">{avgScore.toFixed(0)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auto-submitted</CardDescription>
            <CardTitle className="text-2xl">
              {filtered.filter((a) => a.status === "auto_submitted").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by quiz title"
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading results…</p>
      ) : !filtered.length ? (
        <p className="text-muted-foreground">No results yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{titleByQuiz?.[a.quiz_id] ?? "Quiz"}</div>
                  <div className="text-muted-foreground">
                    {new Date(a.submitted_at).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Score: {(a.score ?? 0).toFixed(0)}% · Status: {a.status.replace("_", " ")} · Reason: {a.submitted_reason.replace("_", " ")}
                </div>
                <div className="text-muted-foreground">
                  Focus violations: {a.focus_violations} · Time spent: {Math.round(a.time_spent_seconds / 60)} min
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
