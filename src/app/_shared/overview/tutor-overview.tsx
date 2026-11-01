import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardCheck, ListChecks, Upload, Users, UsersRound } from "lucide-react";
import { isoDaysAgo } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import type { Actor } from "@/lib/auth/identity";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel, PanelLink, StatCard } from "@/components/ui/page";
import { firstName, greeting, shortTime, todayDayOfWeek } from "./helpers";

export async function TutorOverview({ actor }: { actor: Actor }) {
  const db = getDb();
  const inst = actor.institution_id!;
  const weekAgo = isoDaysAgo(7);

  const [slots, cohorts, students, quizzes] = await Promise.all([
    db
      .from("timetables")
      .select("id, subject, start_time, end_time, room, cohort_id, tutor_id")
      .eq("institution_id", inst)
      .eq("day_of_week", todayDayOfWeek())
      .order("start_time"),
    db.from("cohorts").select("id, name").eq("institution_id", inst),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("institution_id", inst).eq("role", "student").is("deleted_at", null),
    db.from("quizzes").select("id").eq("institution_id", inst),
  ]);

  const quizIds = ((quizzes.data ?? []) as { id: string }[]).map((q) => q.id);
  const recentAttempts = quizIds.length
    ? await db.from("quiz_attempts").select("id", { count: "exact", head: true }).in("quiz_id", quizIds).gte("submitted_at", weekAgo)
    : { count: 0 };

  const cohortRows = (cohorts.data ?? []) as { id: string; name: string }[];
  const cohortName = Object.fromEntries(cohortRows.map((c) => [c.id, c.name]));
  const todaySlots = (slots.data ?? []) as {
    id: string;
    subject: string;
    start_time: string;
    end_time: string;
    room: string | null;
    cohort_id: string | null;
    tutor_id: string | null;
  }[];
  const mine = todaySlots.filter((s) => s.tutor_id === actor.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName(actor.profile?.full_name, actor.user.email)}`}
        description={
          mine.length
            ? `You have ${mine.length} ${mine.length === 1 ? "class" : "classes"} today.`
            : "No classes of yours on the timetable today."
        }
        actions={
          <Button asChild>
            <Link href="/tutor/attendance">
              <ClipboardCheck /> Take attendance
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone="primary" icon={CalendarDays} label="Classes today" value={todaySlots.length} hint={`${mine.length} taught by you`} href="/tutor/timetable" />
        <StatCard icon={Users} label="Students" value={students.count ?? 0} hint={`${cohortRows.length} cohorts`} href="/tutor/cohorts" />
        <StatCard icon={ListChecks} label="Quiz attempts this week" value={recentAttempts.count ?? 0} href="/tutor/results" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Today's timetable" action={<PanelLink href="/tutor/timetable">Full week</PanelLink>}>
          {todaySlots.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing scheduled today" />
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {todaySlots.map((s) => (
                <li key={s.id} className="flex items-center gap-4 py-3">
                  <span className="w-24 shrink-0 font-mono text-sm text-primary">
                    {shortTime(s.start_time)}–{shortTime(s.end_time)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.subject}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {(s.cohort_id && cohortName[s.cohort_id]) || "All cohorts"}
                      {s.room ? ` · ${s.room}` : ""}
                    </span>
                  </span>
                  {s.tutor_id === actor.user.id ? <Badge tone="neon">You</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick actions">
          <div className="grid gap-2">
            {[
              { href: "/tutor/attendance", label: "Mark attendance", icon: ClipboardCheck },
              { href: "/tutor/subjects", label: "Upload a material", icon: Upload },
              { href: "/tutor/quizzes/new", label: "Create a quiz", icon: ListChecks },
              { href: "/tutor/cohorts", label: "View cohorts", icon: UsersRound },
              { href: "/tutor/community", label: "Answer questions", icon: BookOpen },
            ].map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted">
                <q.icon className="size-4 text-primary" /> {q.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
