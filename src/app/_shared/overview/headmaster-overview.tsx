import Link from "next/link";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Inbox,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { getDb } from "@/lib/server/db";
import type { Actor } from "@/lib/auth/identity";
import { BILLING_PLAN_DEFINITIONS, getEffectiveTier } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel, PanelLink, StatCard } from "@/components/ui/page";
import { CopyJoinLink } from "./copy-join-link";
import { firstName, formatPula, greeting, shortTime, startOfMonthIso, todayDayOfWeek, todayIso } from "./helpers";

export async function HeadmasterOverview({ actor }: { actor: Actor }) {
  const db = getDb();
  const inst = actor.institution_id!;

  const [institution, students, tutors, cohorts, joinRequests, attendanceToday, paymentsMonth, slots, slotCount] =
    await Promise.all([
      db.from("institutions").select("name, subdomain, subscription_tier, is_trial, trial_ends_at, student_limit").eq("id", inst).maybeSingle(),
      db.from("profiles").select("id, cohort_id").eq("institution_id", inst).eq("role", "student").is("deleted_at", null),
      db.from("profiles").select("id, full_name, email").eq("institution_id", inst).eq("role", "tutor").is("deleted_at", null),
      db.from("cohorts").select("id, name").eq("institution_id", inst),
      db.from("join_requests").select("id", { count: "exact", head: true }).eq("institution_id", inst).eq("status", "pending"),
      db.from("attendance").select("status").eq("institution_id", inst).eq("date", todayIso()),
      db.from("cash_payments").select("student_id, amount").eq("institution_id", inst).gte("paid_at", startOfMonthIso()),
      db.from("timetables").select("id, subject, start_time, end_time, room, cohort_id, tutor_id").eq("institution_id", inst).eq("day_of_week", todayDayOfWeek()).order("start_time"),
      db.from("timetables").select("id", { count: "exact", head: true }).eq("institution_id", inst),
    ]);

  const studentRows = (students.data ?? []) as { id: string; cohort_id: string | null }[];
  const tutorRows = (tutors.data ?? []) as { id: string; full_name: string | null; email: string }[];
  const cohortRows = (cohorts.data ?? []) as { id: string; name: string }[];
  const cohortName = Object.fromEntries(cohortRows.map((c) => [c.id, c.name]));
  const tutorName = Object.fromEntries(tutorRows.map((t) => [t.id, t.full_name || t.email]));
  const unassigned = studentRows.filter((s) => !s.cohort_id).length;
  const pendingJoins = joinRequests.count ?? 0;

  const att = (attendanceToday.data ?? []) as { status: string }[];
  const present = att.filter((a) => a.status !== "absent").length;
  const attendancePct = att.length ? Math.round((present / att.length) * 100) : null;

  const payments = (paymentsMonth.data ?? []) as { student_id: string; amount: number }[];
  const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidStudents = new Set(payments.map((p) => p.student_id));
  const unpaid = studentRows.filter((s) => !paidStudents.has(s.id)).length;

  const todaySlots = (slots.data ?? []) as {
    id: string;
    subject: string;
    start_time: string;
    end_time: string;
    room: string | null;
    cohort_id: string | null;
    tutor_id: string | null;
  }[];

  const tier = getEffectiveTier(institution.data?.subscription_tier, institution.data?.is_trial);
  const plan = BILLING_PLAN_DEFINITIONS[tier];
  const limit = Number(institution.data?.student_limit ?? 0);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const joinUrl = `${appUrl}/join/${institution.data?.subdomain ?? ""}`;

  const setup = [
    { done: cohortRows.length > 0, label: "Create your first cohort", href: "/headmaster/cohorts" },
    { done: tutorRows.length > 0, label: "Add a tutor", href: "/headmaster/staff" },
    { done: (slotCount.count ?? 0) > 0, label: "Build the timetable", href: "/headmaster/timetable" },
    { done: studentRows.length > 0, label: "Share your join link with students", href: "#join-link" },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName(actor.profile?.full_name, actor.user.email)}`}
        description={`Here's ${institution.data?.name ?? "your centre"} today.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/headmaster/staff">
                <UserPlus /> Add people
              </Link>
            </Button>
            <Button asChild>
              <Link href="/headmaster/payments">
                <Wallet /> Record a payment
              </Link>
            </Button>
          </>
        }
      />

      {pendingJoins > 0 ? (
        <Link
          href="/headmaster/staff#requests"
          className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-secondary/60 px-5 py-4 text-sm transition-colors hover:bg-secondary"
        >
          <Inbox className="size-5 text-primary" />
          <span className="flex-1">
            <strong>{pendingJoins}</strong> {pendingJoins === 1 ? "student is" : "students are"} waiting for approval to join.
          </span>
          <span className="font-semibold text-primary">Review</span>
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="primary"
          icon={Users}
          label="Active students"
          value={studentRows.length}
          hint={limit ? `${plan.displayName} plan · ${limit} seats` : `${plan.displayName} plan`}
          href="/headmaster/staff"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Attendance today"
          value={attendancePct === null ? "–" : `${attendancePct}%`}
          hint={att.length ? `${present} of ${att.length} marked present or late` : "Not marked yet"}
        />
        <StatCard
          icon={Wallet}
          label="Fees this month"
          value={formatPula(collected)}
          hint={`${unpaid} ${unpaid === 1 ? "student hasn't" : "students haven't"} paid yet`}
          tone={unpaid > 0 ? "warning" : "success"}
          href="/headmaster/payments"
        />
        <StatCard
          icon={UsersRound}
          label="Cohorts and tutors"
          value={`${cohortRows.length} · ${tutorRows.length}`}
          hint={unassigned ? `${unassigned} ${unassigned === 1 ? "student needs" : "students need"} a cohort` : "Everyone is placed"}
          tone={unassigned ? "warning" : "default"}
          href="/headmaster/cohorts"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Today's classes" action={<PanelLink href="/headmaster/timetable">Timetable</PanelLink>}>
          {todaySlots.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes today" body="Add slots to the timetable and they'll show here." />
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
                      {s.tutor_id && tutorName[s.tutor_id] ? ` · ${tutorName[s.tutor_id]}` : ""}
                    </span>
                  </span>
                  {s.room ? <Badge>{s.room}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {setupDone < setup.length ? (
            <Panel title={`Get set up · ${setupDone}/${setup.length}`}>
              <ul className="space-y-1">
                {setup.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted">
                      {s.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
                      <span className={s.done ? "text-muted-foreground line-through" : "font-medium"}>{s.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Student join link">
            <div id="join-link" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this on WhatsApp or print it. Students ask to join and you approve them.
              </p>
              <CopyJoinLink url={joinUrl} />
            </div>
          </Panel>

          <Panel title="Quick links">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/headmaster/results", label: "Quiz results", icon: BookOpenCheck },
                { href: "/headmaster/reports", label: "Student reports", icon: ClipboardCheck },
                { href: "/headmaster/cohorts", label: "Cohorts", icon: UsersRound },
                { href: "/headmaster/settings", label: "Branding", icon: Users },
              ].map((q) => (
                <Link key={q.href} href={q.href} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted">
                  <q.icon className="size-4 text-primary" /> {q.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
