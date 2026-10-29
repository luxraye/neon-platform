import Link from "next/link";
import { BookOpen, CalendarDays, Clock, GraduationCap, Hourglass, ListChecks, Smartphone, Trophy } from "lucide-react";
import { getDb } from "@/lib/server/db";
import type { Actor } from "@/lib/auth/identity";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel, PanelLink, StatCard } from "@/components/ui/page";
import { firstName, greeting, shortTime, todayDayOfWeek, todayIso } from "./helpers";

export async function StudentOverview({ actor }: { actor: Actor }) {
  const name = firstName(actor.profile?.full_name, actor.user.email);
  const cohortId = actor.profile?.cohort_id ?? null;

  if (!cohortId) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome, ${name}`} description={`You're signed in to ${actor.institution_name ?? "your centre"}.`} />
        <div className="rounded-3xl bg-ink p-8 text-white">
          <Hourglass className="size-8 text-neon" />
          <h2 className="mt-4 text-2xl font-extrabold">Almost there</h2>
          <p className="mt-2 max-w-lg text-white/70">
            Your centre still needs to put you in a class. Once they do, your timetable, notes and quizzes will appear here.
          </p>
          <Button asChild variant="neon" className="mt-6">
            <Link href="/student/mobile-setup">
              <Smartphone /> Install Neon on your phone
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const db = getDb();
  const inst = actor.institution_id!;
  const [cohort, slots, materials, quizzes, attempts] = await Promise.all([
    db.from("cohorts").select("name").eq("id", cohortId).maybeSingle(),
    db
      .from("timetables")
      .select("id, subject, start_time, end_time, room")
      .eq("institution_id", inst)
      .eq("cohort_id", cohortId)
      .eq("day_of_week", todayDayOfWeek())
      .order("start_time"),
    db.from("materials").select("id, title, subject, created_at, cohort_id").eq("institution_id", inst).order("created_at", { ascending: false }).limit(30),
    db.from("quizzes").select("id, title, due_at").eq("institution_id", inst).eq("cohort_id", cohortId),
    db.from("quiz_attempts").select("quiz_id, score, status").eq("student_id", actor.user.id),
  ]);

  const todaySlots = (slots.data ?? []) as { id: string; subject: string; start_time: string; end_time: string; room: string | null }[];
  const latest = ((materials.data ?? []) as { id: string; title: string; subject: string | null; cohort_id: string | null }[])
    .filter((m) => m.cohort_id === null || m.cohort_id === cohortId)
    .slice(0, 4);
  const done = (attempts.data ?? []) as { quiz_id: string; score: number | null; status: string }[];
  const finished = done.filter((a) => a.status !== "in_progress");
  const attemptedIds = new Set(done.map((a) => a.quiz_id));
  const today = todayIso();
  const open = ((quizzes.data ?? []) as { id: string; title: string; due_at: string | null }[])
    .filter((q) => !attemptedIds.has(q.id) && (!q.due_at || q.due_at >= today))
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
  const avg = finished.length ? Math.round(finished.reduce((s, a) => s + Number(a.score ?? 0), 0) / finished.length) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${name}`} description={cohort.data?.name ? `Class: ${cohort.data.name}` : undefined} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone="primary" icon={CalendarDays} label="Classes today" value={todaySlots.length} href="/student/timetable" />
        <StatCard icon={ListChecks} label="Quizzes to do" value={open.length} hint={open[0]?.due_at ? `Next due ${open[0].due_at}` : undefined} href="/student/learn" />
        <StatCard icon={Trophy} label="Average score" value={avg === null ? "–" : `${avg}%`} hint={`${finished.length} quizzes done`} href="/student/results" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Today" action={<PanelLink href="/student/timetable">Week</PanelLink>}>
          {todaySlots.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes today" body="Enjoy the break, or catch up on your notes." />
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {todaySlots.map((s) => (
                <li key={s.id} className="flex items-center gap-4 py-3">
                  <Clock className="size-4 text-primary" />
                  <span className="w-24 shrink-0 font-mono text-sm">
                    {shortTime(s.start_time)}–{shortTime(s.end_time)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.subject}</span>
                  {s.room ? <Badge>{s.room}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quizzes waiting for you" action={<PanelLink href="/student/learn">Learn</PanelLink>}>
          {open.length === 0 ? (
            <EmptyState icon={GraduationCap} title="All done" body="New quizzes from your tutors will show here." />
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {open.slice(0, 4).map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="truncate font-semibold">{q.title}</span>
                  {q.due_at ? <Badge tone={q.due_at <= today ? "warning" : "primary"}>Due {q.due_at}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="New notes and materials" action={<PanelLink href="/student/learn">All materials</PanelLink>}>
        {latest.length === 0 ? (
          <EmptyState icon={BookOpen} title="No materials yet" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {latest.map((m) => (
              <li key={m.id}>
                <Link href="/student/learn" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                    <BookOpen className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{m.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.subject ?? "General"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
