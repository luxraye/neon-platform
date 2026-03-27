"use client";

import { useProfile } from "@/hooks/use-profile";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type AttemptWithQuiz = {
  id: string;
  quiz_id: string;
  score: number;
  submitted_at: string;
  quiz_title: string;
};

function useMyAttempts(userId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["my-quiz-attempts", userId ?? ""],
    queryFn: async (): Promise<AttemptWithQuiz[]> => {
      if (!userId) return [];
      const { data: attempts, error: e1 } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, score, submitted_at")
        .eq("student_id", userId)
        .order("submitted_at", { ascending: true });
      if (e1) throw e1;
      if (!attempts?.length) return [];
      const quizIds = [...new Set(attempts.map((a) => a.quiz_id))];
      const { data: quizzes, error: e2 } = await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);
      if (e2) throw e2;
      const titleByQuiz: Record<string, string> = {};
      (quizzes ?? []).forEach((q: { id: string; title: string }) => {
        titleByQuiz[q.id] = q.title;
      });
      return (attempts ?? []).map((a) => ({
        ...a,
        quiz_title: titleByQuiz[a.quiz_id] ?? "Quiz",
      })) as AttemptWithQuiz[];
    },
    enabled: !!userId,
  });
}

export default function ProgressPage() {
  const { data: profileData } = useProfile();
  const userId = profileData?.user?.id ?? null;
  const { data: attempts, isLoading } = useMyAttempts(userId);

  if (!profileData?.profile) {
    return (
      <div className="px-2 sm:px-4">
        <h1 className="text-xl font-semibold mb-2">My Progress</h1>
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (profileData.profile.role !== "student") {
    return (
      <div className="px-2 sm:px-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/learn">← Learn</Link>
        </Button>
        <h1 className="text-xl font-semibold mt-4 mb-2">My Progress</h1>
        <p className="text-muted-foreground text-sm">This view is for students. Go to Learn to manage content.</p>
      </div>
    );
  }

  const byDate = (attempts ?? []).slice().sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
  const byQuizTitle: Record<string, { sum: number; count: number }> = {};
  (attempts ?? []).forEach((a) => {
    const t = a.quiz_title;
    if (!byQuizTitle[t]) byQuizTitle[t] = { sum: 0, count: 0 };
    byQuizTitle[t].sum += a.score;
    byQuizTitle[t].count += 1;
  });
  const maxScore = Math.max(...(attempts ?? []).map((a) => a.score), 1);

  return (
    <div className="px-2 sm:px-4 pb-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/learn">← Learn</Link>
      </Button>
      <h1 className="text-xl sm:text-2xl font-semibold mt-4 mb-4">My Progress</h1>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {!isLoading && (!attempts?.length ? (
        <p className="text-muted-foreground text-sm">No quiz attempts yet. Take quizzes from Learn to see progress here.</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-base font-medium mb-3">Scores over time</h2>
            <div className="flex items-end gap-1 h-40">
              {byDate.map((a) => (
                <div
                  key={a.id}
                  className="flex-1 min-w-[8px] flex flex-col items-center gap-1"
                  title={`${a.quiz_title}: ${a.score.toFixed(0)}%`}
                >
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all"
                    style={{ height: `${(a.score / maxScore) * 120}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">
                    {new Date(a.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-medium mb-3">Subject / quiz breakdown</h2>
            <div className="space-y-2">
              {Object.entries(byQuizTitle).map(([title, { sum, count }]) => {
                const avg = count ? sum / count : 0;
                return (
                  <div key={title} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate">{title}</span>
                    <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all"
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12">{avg.toFixed(0)}% avg</span>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="mt-6 text-sm text-muted-foreground">
            <Link href="/dashboard/reports" className="underline">View full report</Link> for attendance and print.
          </p>
        </>
      ))}
    </div>
  );
}
