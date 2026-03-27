"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Quiz = {
  id: string;
  title: string;
  cohort_id: string | null;
  time_limit_minutes: number;
  max_focus_violations: number;
  created_at: string;
};

function useQuizzes(institutionId: string | null) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["quizzes", institutionId ?? ""],
    queryFn: async (): Promise<Quiz[]> => {
      if (!institutionId) return [];
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, cohort_id, time_limit_minutes, max_focus_violations, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Quiz[];
    },
    enabled: !!institutionId,
  });
}

export default function QuizzesPage() {
  const pathname = usePathname() ?? "";
  const { data: profileData } = useProfile();
  const { isStaff: canManage, role } = useStaffRole();
  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    null;
  const { data: cohorts } = useCohorts(institutionId);
  const { data: quizzes, isLoading, isError, error } = useQuizzes(institutionId);

  const newQuizHref =
    role === "tutor" || pathname.startsWith("/tutor")
      ? "/tutor/quizzes/new"
      : "/dashboard/quizzes/new";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multiple choice only. Each quiz uses a countdown timer (set the limit when you create it).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/results">Results</Link>
          </Button>
          {canManage && (
            <Button asChild>
              <Link href={newQuizHref}>Create quiz</Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading quizzes…</p>}
      {isError && (
        <p className="text-destructive">Error: {error?.message}</p>
      )}
      {!isLoading && !isError && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Time limit</TableHead>
                <TableHead>Security</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!quizzes?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {canManage ? (
                      <>
                        No quizzes yet.{" "}
                        <Link href={newQuizHref} className="text-primary underline font-medium">
                          Create your first multiple-choice quiz
                        </Link>{" "}
                        (timer included).
                      </>
                    ) : (
                      "No quizzes published for your cohort yet."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                quizzes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cohorts?.find((c) => c.id === q.cohort_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.time_limit_minutes} min
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      Medium ({q.max_focus_violations} violations)
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
