"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Download, MapPin, Plus, Trash2 } from "lucide-react";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { useTimetableSlots, type TimetableSlot } from "@/hooks/use-timetable";
import { FeatureGate } from "@/components/dashboard/feature-gate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { createTimetableSlot, deleteTimetableSlot } from "./actions";
import { qStaffNames } from "@/app/data/queries";
import { getStaff } from "../staff/actions";

const DAYS = [
  { d: 1, label: "Monday", short: "Mon" },
  { d: 2, label: "Tuesday", short: "Tue" },
  { d: 3, label: "Wednesday", short: "Wed" },
  { d: 4, label: "Thursday", short: "Thu" },
  { d: 5, label: "Friday", short: "Fri" },
  { d: 6, label: "Saturday", short: "Sat" },
];

const hhmm = (t: string) => t.slice(0, 5);

function todayDay() {
  const js = new Date().getDay(); // 0 = Sunday
  return js === 0 ? 1 : Math.min(js, 6);
}

type Draft = {
  cohort_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room: string;
  tutor_id: string;
};

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const { isStaff, role, profileData } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const isStudent = role === "student";
  const studentCohortId = isStudent ? profileData?.profile?.cohort_id ?? null : null;

  const [cohortFilter, setCohortFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [mobileDay, setMobileDay] = useState(todayDay);
  const queryCohort = isStaff ? (cohortFilter === "all" ? null : cohortFilter) : studentCohortId;

  const { data: slots, isLoading } = useTimetableSlots(institutionId, queryCohort);
  const { data: staffNames } = useQuery({
    queryKey: ["timetable-staff", institutionId ?? ""],
    queryFn: () => qStaffNames(),
    enabled: !!institutionId,
  });
  const { data: staff } = useQuery({
    queryKey: ["staff", "list"],
    queryFn: () => getStaff(),
    enabled: role === "headmaster",
  });
  const tutors = (staff?.tutors ?? []).filter((t) => !t.deleted_at);

  const cohortName = useMemo(
    () => Object.fromEntries((cohorts ?? []).map((c) => [c.id, c.name])) as Record<string, string>,
    [cohorts]
  );

  const visible = useMemo(() => {
    const list = (slots ?? []).filter((s) => !mineOnly || s.tutor_id === profileData?.profile?.id);
    return [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slots, mineOnly, profileData?.profile?.id]);

  const byDay = useMemo(() => {
    const m = new Map<number, TimetableSlot[]>();
    for (const d of DAYS) m.set(d.d, []);
    for (const s of visible) m.get(s.day_of_week)?.push(s);
    return m;
  }, [visible]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = (day: number) =>
    setDraft({
      cohort_id: queryCohort ?? cohorts?.[0]?.id ?? "",
      day_of_week: day,
      start_time: "15:00",
      end_time: "16:00",
      subject: "",
      room: "",
      tutor_id: "",
    });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["timetable"] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const res = await createTimetableSlot({
      cohort_id: draft.cohort_id,
      day_of_week: draft.day_of_week,
      start_time: draft.start_time,
      end_time: draft.end_time,
      subject: draft.subject,
      room: draft.room || undefined,
      tutor_id: draft.tutor_id || null,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Class added.");
    setDraft(null);
    refresh();
  }

  async function remove(slot: TimetableSlot) {
    if (!confirm(`Remove ${slot.subject} on ${DAYS.find((d) => d.d === slot.day_of_week)?.label}?`)) return;
    const res = await deleteTimetableSlot(slot.id);
    if (!res.success) toast.error(res.error);
    else {
      toast.success("Class removed.");
      refresh();
    }
  }

  function downloadCsv() {
    if (!visible.length) {
      toast.info("Nothing to download yet.");
      return;
    }
    const rows = [
      ["Day", "Start", "End", "Subject", "Cohort", "Tutor", "Room"],
      ...visible.map((s) => [
        DAYS.find((d) => d.d === s.day_of_week)?.label ?? String(s.day_of_week),
        hhmm(s.start_time),
        hhmm(s.end_time),
        s.subject,
        s.cohort_id ? cohortName[s.cohort_id] ?? "" : "All cohorts",
        s.tutor_id ? staffNames?.[s.tutor_id] ?? "" : "",
        s.room ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const SlotCard = ({ s }: { s: TimetableSlot }) => (
    <div className="group relative rounded-xl border border-border bg-card p-3 text-sm shadow-xs">
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" aria-hidden />
      <p className="font-mono text-xs text-primary">
        {hhmm(s.start_time)}–{hhmm(s.end_time)}
      </p>
      <p className="mt-0.5 font-bold leading-snug">{s.subject}</p>
      <p className="truncate text-xs text-muted-foreground">
        {isStaff ? (s.cohort_id ? cohortName[s.cohort_id] ?? "Cohort" : "All cohorts") : null}
        {isStaff && s.tutor_id && staffNames?.[s.tutor_id] ? " · " : null}
        {s.tutor_id ? staffNames?.[s.tutor_id] ?? "" : ""}
      </p>
      {s.room ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" /> {s.room}
        </p>
      ) : null}
      {isStaff ? (
        <button
          type="button"
          onClick={() => remove(s)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-100 hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
          aria-label={`Remove ${s.subject}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );

  const noCohort = isStudent && !studentCohortId;
  const noCohortsYet = isStaff && (cohorts?.length ?? 0) === 0;

  return (
    <FeatureGate feature="timetable" fallback={<TimetableUpgradeMessage />}>
      <div className="space-y-6">
        <PageHeader
          title="Timetable"
          description={isStudent ? "Your classes for the week." : "Plan the week for each cohort. Students see their own cohort's classes."}
          actions={
            isStaff ? (
              <>
                <Button variant="outline" onClick={downloadCsv}>
                  <Download /> CSV
                </Button>
                {!noCohortsYet ? (
                  <Button onClick={() => openNew(mobileDay)}>
                    <Plus /> Add class
                  </Button>
                ) : null}
              </>
            ) : null
          }
        />

        {isStaff && !noCohortsYet ? (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={cohortFilter} onValueChange={setCohortFilter}>
              <SelectTrigger className="w-52" aria-label="Cohort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohorts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role === "tutor" ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                />
                Only my classes
              </label>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {visible.length} {visible.length === 1 ? "class" : "classes"} a week
            </span>
          </div>
        ) : null}

        {noCohort ? (
          <EmptyState icon={CalendarDays} title="No timetable yet" body="Your centre hasn't placed you in a class. Your timetable appears here once they do." />
        ) : noCohortsYet ? (
          <EmptyState icon={CalendarDays} title="Create a cohort first" body="Timetable slots belong to a cohort. Add one on the Cohorts page." />
        ) : isLoading ? (
          <div className="grid gap-3 lg:grid-cols-6">
            {DAYS.map((d) => (
              <div key={d.d} className="h-48 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {/* Phone: one day at a time */}
            <div className="lg:hidden">
              <div className="mb-4 grid grid-cols-6 gap-1 rounded-xl border border-border bg-card p-1" role="tablist">
                {DAYS.map((d) => {
                  const count = byDay.get(d.d)?.length ?? 0;
                  return (
                    <button
                      key={d.d}
                      role="tab"
                      aria-selected={mobileDay === d.d}
                      onClick={() => setMobileDay(d.d)}
                      className={cn(
                        "flex flex-col items-center rounded-lg py-1.5 text-xs font-semibold",
                        mobileDay === d.d ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {d.short}
                      <span className={cn("mt-0.5 size-1.5 rounded-full", count ? (mobileDay === d.d ? "bg-neon" : "bg-primary") : "bg-transparent")} />
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {(byDay.get(mobileDay) ?? []).length === 0 ? (
                  <EmptyState
                    title="No classes"
                    body={`Nothing on ${DAYS.find((d) => d.d === mobileDay)?.label}.`}
                    action={
                      isStaff ? (
                        <Button variant="outline" onClick={() => openNew(mobileDay)}>
                          <Plus /> Add class
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  byDay.get(mobileDay)!.map((s) => <SlotCard key={s.id} s={s} />)
                )}
              </div>
            </div>

            {/* Desktop: the whole week */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-6">
              {DAYS.map((d) => {
                const list = byDay.get(d.d) ?? [];
                const isToday = d.d === todayDay() && new Date().getDay() !== 0;
                return (
                  <section key={d.d} className={cn("flex min-h-64 flex-col rounded-2xl border bg-muted/40 p-2", isToday ? "border-primary/40" : "border-border")}>
                    <header className="flex items-center justify-between px-1.5 pb-2 pt-1">
                      <h2 className="text-sm font-bold">
                        {d.label}
                        {isToday ? <span className="ml-1.5 rounded-full bg-neon px-1.5 py-0.5 text-[10px] text-neon-foreground">Today</span> : null}
                      </h2>
                      {isStaff ? (
                        <button
                          type="button"
                          onClick={() => openNew(d.d)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-primary"
                          aria-label={`Add class on ${d.label}`}
                        >
                          <Plus className="size-4" />
                        </button>
                      ) : null}
                    </header>
                    <div className="flex-1 space-y-2">
                      {list.map((s) => (
                        <SlotCard key={s.id} s={s} />
                      ))}
                      {list.length === 0 ? <p className="px-1.5 pt-2 text-xs text-muted-foreground">Free</p> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a class</DialogTitle>
              <DialogDescription>It repeats every week until you remove it.</DialogDescription>
            </DialogHeader>
            {draft ? (
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slot-subject">Subject</Label>
                  <Input
                    id="slot-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    placeholder="Mathematics"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cohort</Label>
                    <Select value={draft.cohort_id} onValueChange={(v) => setDraft({ ...draft, cohort_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={String(draft.day_of_week)} onValueChange={(v) => setDraft({ ...draft, day_of_week: Number(v) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => (
                          <SelectItem key={d.d} value={String(d.d)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-start">Starts</Label>
                    <Input id="slot-start" type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slot-end">Ends</Label>
                    <Input id="slot-end" type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} required />
                  </div>
                </div>
                {role === "headmaster" ? (
                  <div className="space-y-2">
                    <Label>Tutor</Label>
                    <Select value={draft.tutor_id || "me"} onValueChange={(v) => setDraft({ ...draft, tutor_id: v === "me" ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="me">Me</SelectItem>
                        {tutors.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.full_name || t.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="slot-room">Room</Label>
                  <Input id="slot-room" value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="Optional" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !draft.cohort_id}>
                    {saving ? "Adding…" : "Add class"}
                  </Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}

function TimetableUpgradeMessage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Timetable" />
      <EmptyState icon={CalendarDays} title="Not on your plan" body="Ask your centre's headmaster to upgrade to use the timetable." />
    </div>
  );
}
