"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, ClipboardCheck, MessageSquare, WifiOff } from "lucide-react";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { useCohortStudents } from "@/hooks/use-cohort-students";
import { useAttendanceForDate } from "@/hooks/use-attendance";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { saveAttendance } from "./actions";
import { db } from "@/lib/db";

const STATUSES = [
  { key: "present", label: "Present", on: "bg-success text-success-foreground border-success" },
  { key: "late", label: "Late", on: "bg-warning text-warning-foreground border-warning" },
  { key: "absent", label: "Absent", on: "bg-destructive text-white border-destructive" },
] as const;
type Status = (typeof STATUSES)[number]["key"];

/** Today's date in the user's own timezone (not UTC), as YYYY-MM-DD. */
function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { isStaff, profileData } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [date, setDate] = useState(localToday);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [openRemark, setOpenRemark] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!cohortId && cohorts?.length) setCohortId(cohorts[0].id);
  }, [cohorts, cohortId]);

  const { data: students, isLoading: studentsLoading } = useCohortStudents(institutionId, cohortId);
  const { data: existing, isLoading: attendanceLoading } = useAttendanceForDate(institutionId, cohortId, date);

  useEffect(() => {
    const s: Record<string, Status> = {};
    const r: Record<string, string> = {};
    for (const row of existing ?? []) {
      s[row.student_id] = row.status;
      if (row.remarks) r[row.student_id] = row.remarks;
    }
    setStatus(s);
    setRemarks(r);
  }, [existing]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, unmarked: 0 };
    for (const s of students ?? []) {
      const v = status[s.id];
      if (v) c[v] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [students, status]);

  const alreadySaved = (existing?.length ?? 0) > 0;

  async function save() {
    if (!cohortId || !students?.length) return;
    const entries = students.map((s) => ({
      student_id: s.id,
      date,
      status: status[s.id] ?? "present",
      remarks: remarks[s.id] || undefined,
    }));

    if (!online) {
      const drafts = await db.attendance_drafts.where("[cohort_id+date]").equals([cohortId, date]).toArray();
      for (const d of drafts) await db.attendance_drafts.delete(d.id);
      for (const e of entries) {
        await db.attendance_drafts.add({
          id: crypto.randomUUID(),
          cohort_id: cohortId,
          date,
          student_id: e.student_id,
          status: e.status,
          remarks: e.remarks ?? null,
          pending: 1,
          updated_at: Date.now(),
        });
      }
      toast.success("Saved on this phone. It syncs when you're back online.");
      return;
    }

    setSaving(true);
    const res = await saveAttendance(cohortId, entries);
    setSaving(false);
    if (res.success) {
      toast.success("Attendance saved.");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    } else toast.error(res.error);
  }

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" />
        <EmptyState icon={ClipboardCheck} title="Staff only" body="Tutors and headmasters mark attendance." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Tap each student's status. Anyone you don't mark is saved as present."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={cohortId ?? ""} onValueChange={(v) => setCohortId(v || null)}>
          <SelectTrigger className="sm:w-56" aria-label="Cohort">
            <SelectValue placeholder="Choose a cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          max={localToday()}
          onChange={(e) => setDate(e.target.value || localToday())}
          className="sm:w-44"
          aria-label="Date"
        />
        {!online ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <WifiOff className="size-4" /> Offline. Saves to this phone.
          </span>
        ) : alreadySaved ? (
          <span className="text-sm text-muted-foreground">Already saved for this day. Changes overwrite it.</span>
        ) : null}
      </div>

      {!cohorts?.length ? (
        <EmptyState icon={ClipboardCheck} title="No cohorts yet" body="Create a cohort and add students to it first." />
      ) : studentsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : !students?.length ? (
        <EmptyState icon={ClipboardCheck} title="No students in this cohort" body="Place students in this cohort from the People page." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-success/10 px-3 py-1 font-semibold text-success">{counts.present} present</span>
            <span className="rounded-full bg-warning/10 px-3 py-1 font-semibold text-warning">{counts.late} late</span>
            <span className="rounded-full bg-destructive/10 px-3 py-1 font-semibold text-destructive">{counts.absent} absent</span>
            {counts.unmarked ? <span className="text-muted-foreground">{counts.unmarked} not marked</span> : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setStatus(Object.fromEntries(students.map((s) => [s.id, "present" as Status])))}
            >
              <CheckCheck /> Everyone present
            </Button>
          </div>

          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {students.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 truncate font-semibold">{s.full_name || s.email}</p>
                  <div className="flex gap-1.5" role="radiogroup" aria-label={`Status for ${s.full_name || s.email}`}>
                    {STATUSES.map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        role="radio"
                        aria-checked={status[s.id] === st.key}
                        onClick={() => setStatus((p) => ({ ...p, [s.id]: st.key }))}
                        className={cn(
                          "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                          status[s.id] === st.key ? st.on : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOpenRemark(openRemark === s.id ? null : s.id)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted",
                        remarks[s.id] && "border-primary/40 text-primary"
                      )}
                      aria-label="Add a note"
                    >
                      <MessageSquare className="size-4" />
                    </button>
                  </div>
                </div>
                {openRemark === s.id || remarks[s.id] ? (
                  <Input
                    className="mt-2"
                    placeholder="Note, e.g. left early for clinic"
                    value={remarks[s.id] ?? ""}
                    onChange={(e) => setRemarks((p) => ({ ...p, [s.id]: e.target.value }))}
                    autoFocus={openRemark === s.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
            <Button size="lg" className="shadow-lg" onClick={save} disabled={saving || attendanceLoading}>
              {saving ? "Saving…" : online ? "Save attendance" : "Save on this phone"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
