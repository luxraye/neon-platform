"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarClock, ClipboardList, HelpCircle, Plus, Timer } from "lucide-react";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { qQuizzes } from "@/app/data/queries";
import { roleRoot } from "@/lib/role-root";
import { isPast } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/page";

export default function QuizzesPage() {
  const pathname = usePathname();
  const { isStaff, role, profileData } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["quizzes", institutionId ?? ""],
    queryFn: () => qQuizzes(),
    enabled: !!institutionId,
  });
  const root = roleRoot(role, pathname);
  const cohortName = (id: string | null) => (id ? cohorts?.find((c) => c.id === id)?.name ?? "Cohort" : "All cohorts");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes"
        description="Timed multiple-choice quizzes. Answers are checked on the server, so students can't peek."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`${root}/results`}>
                <BarChart3 /> Results
              </Link>
            </Button>
            {isStaff ? (
              <Button asChild>
                <Link href={`${root}/quizzes/new`}>
                  <Plus /> New quiz
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !quizzes?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No quizzes yet"
          body={isStaff ? "Write a short quiz to check what your students remember." : "Quizzes for your class appear here."}
          action={
            isStaff ? (
              <Button asChild>
                <Link href={`${root}/quizzes/new`}>
                  <Plus /> New quiz
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => {
            const due = q.due_at ? new Date(q.due_at) : null;
            const overdue = due ? isPast(due) : false;
            return (
              <article key={q.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone="primary">{cohortName(q.cohort_id)}</Badge>
                  {due ? (
                    <Badge tone={overdue ? "default" : "warning"}>
                      <CalendarClock className="size-3" />
                      {overdue ? "Closed" : `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="mt-3 line-clamp-2 flex-1 text-lg font-bold leading-snug">{q.title}</h2>
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="size-4" /> {q.question_count} {q.question_count === 1 ? "question" : "questions"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-4" /> {q.time_limit_minutes} min
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
