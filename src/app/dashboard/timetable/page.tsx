"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useProfile } from "@/hooks/use-profile";
import { useCohorts } from "@/hooks/use-cohorts";
import { useTimetableSlots, type TimetableSlot } from "@/hooks/use-timetable";
import { FeatureGate } from "@/components/dashboard/feature-gate";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTimetableSlot, deleteTimetableSlot } from "./actions";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";

const DAYS = [
  { d: 1, label: "Monday" },
  { d: 2, label: "Tuesday" },
  { d: 3, label: "Wednesday" },
  { d: 4, label: "Thursday" },
  { d: 5, label: "Friday" },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7);

function timeStr(h: number) {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const supabase = createBrowserSupabaseClient();
  const { data: profileData } = useProfile();
  const { isStaff, role } = useStaffRole();
  const institutionId = profileData?.profile?.institution_id ?? null;
  const { data: cohorts } = useCohorts(institutionId);
  const studentCohortId = profileData?.profile?.role === "student" ? profileData?.profile?.cohort_id ?? null : null;

  const [selectedCohortId, setSelectedCohortId] = useState<string>("all");
  const effectiveCohortId = isStaff
    ? selectedCohortId === "all"
      ? null
      : selectedCohortId
    : studentCohortId;

  const { data: slots, isLoading } = useTimetableSlots(institutionId, effectiveCohortId);
  const { data: tutorMap } = useQuery({
    queryKey: ["timetable-tutors", institutionId ?? ""],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!institutionId) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("institution_id", institutionId)
        .in("role", ["tutor", "headmaster"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        map[p.id] = p.full_name || p.email || "Staff";
      });
      return map;
    },
    enabled: !!institutionId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [slotDay, setSlotDay] = useState(1);
  const [slotStart, setSlotStart] = useState(8);
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openAddSlot = (day: number, startHour: number) => {
    setSlotDay(day);
    setSlotStart(startHour);
    setSubject("");
    setRoom("");
    setDialogOpen(true);
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCohortId || !subject.trim()) {
      toast.error("Select a cohort and enter a subject.");
      return;
    }
    setSubmitting(true);
    const result = await createTimetableSlot({
      cohort_id: effectiveCohortId,
      day_of_week: slotDay,
      start_time: timeStr(slotStart),
      end_time: timeStr(slotStart + 1),
      subject: subject.trim(),
      room: room.trim() || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      toast.success("Class added.");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["timetable", institutionId ?? "", effectiveCohortId] });
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (slotId: string) => {
    const result = await deleteTimetableSlot(slotId);
    if (result.success) {
      toast.success("Slot removed.");
      queryClient.invalidateQueries({ queryKey: ["timetable", institutionId ?? "", effectiveCohortId ?? ""] });
    } else {
      toast.error(result.error);
    }
  };

  const slotsByKey = new Map<string, TimetableSlot>();
  (slots ?? []).forEach((s) => {
    const hour = parseInt(s.start_time.slice(0, 2), 10);
    const key = `${s.day_of_week}-${hour}`;
    slotsByKey.set(key, s);
  });

  const cohortMap = useMemo(() => {
    const map: Record<string, string> = {};
    (cohorts ?? []).forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [cohorts]);

  const myWeeklySlots =
    role === "tutor"
      ? (slots ?? []).filter((s) => s.tutor_id === profileData?.profile?.id).length
      : null;

  const downloadVisibleTimetableCsv = () => {
    if (!slots?.length) {
      toast.info("No timetable data to download.");
      return;
    }
    const rows = [
      ["Day", "Start", "End", "Subject", "Cohort", "Tutor", "Room"],
      ...slots.map((slot) => [
        DAYS.find((d) => d.d === slot.day_of_week)?.label ?? String(slot.day_of_week),
        slot.start_time,
        slot.end_time,
        slot.subject,
        slot.cohort_id ? cohortMap[slot.cohort_id] ?? slot.cohort_id : "All Cohorts",
        slot.tutor_id ? tutorMap?.[slot.tutor_id] ?? slot.tutor_id : "Unassigned",
        slot.room ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neon-timetable-${selectedCohortId === "all" ? "all-cohorts" : selectedCohortId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <FeatureGate feature="timetable" fallback={<TimetableUpgradeMessage />}>
      <div className="px-2 sm:px-4 pb-6">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4">Timetable</h1>

        {isStaff && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
            <Label className="mr-2">Cohort</Label>
            <Select
              value={selectedCohortId}
              onValueChange={setSelectedCohortId}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select cohort" />
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
            </div>
            <Button variant="outline" onClick={downloadVisibleTimetableCsv}>
              Download CSV
            </Button>
          </div>
        )}

        {role === "tutor" && myWeeklySlots !== null && (
          <p className="text-sm text-muted-foreground mb-3">
            Your current weekly workload: <span className="font-medium text-foreground">{myWeeklySlots} slot(s)</span>
          </p>
        )}

        {!effectiveCohortId && isStaff && (
          <p className="text-muted-foreground text-sm">Create a cohort first to add classes.</p>
        )}
        {!effectiveCohortId && profileData?.profile?.role === "student" && (
          <p className="text-muted-foreground text-sm">You’re not assigned to a cohort yet.</p>
        )}

        {effectiveCohortId && (
          <>
            {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {!isLoading && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border border-border p-2 text-left w-20">Time</th>
                      {DAYS.map(({ d, label }) => (
                        <th key={d} className="border border-border p-2 text-left min-w-[120px]">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HOURS.map((h) => (
                      <tr key={h}>
                        <td className="border border-border p-2 text-muted-foreground">
                          {timeStr(h)}–{timeStr(h + 1)}
                        </td>
                        {DAYS.map(({ d }) => {
                          const key = `${d}-${h}`;
                          const slot = slotsByKey.get(key);
                          return (
                            <td key={d} className="border border-border p-1 align-top">
                              {slot ? (
                                <div className="rounded bg-muted/80 p-2 text-xs">
                                  <div className="font-medium">{slot.subject}</div>
                                  <div className="text-muted-foreground">
                                    {slot.cohort_id ? cohortMap[slot.cohort_id] ?? "Cohort" : "All cohorts"}
                                  </div>
                                  {slot.tutor_id && (
                                    <div className="text-muted-foreground">
                                      Tutor: {tutorMap?.[slot.tutor_id] ?? "Staff"}
                                    </div>
                                  )}
                                  {slot.room && <div className="text-muted-foreground">{slot.room}</div>}
                                  {isStaff && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-1 h-6 text-xs"
                                      onClick={() => handleDelete(slot.id)}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                </div>
                              ) : isStaff ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-full min-h-10 w-full text-muted-foreground"
                                  onClick={() => openAddSlot(d, h)}
                                >
                                  +
                                </Button>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add class</DialogTitle>
              <DialogDescription>
                {DAYS.find((x) => x.d === slotDay)?.label}, {timeStr(slotStart)}–{timeStr(slotStart + 1)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Mathematics"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Room (optional)</Label>
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Room number"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding…" : "Add"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </FeatureGate>
  );
}

function TimetableUpgradeMessage() {
  return (
    <div className="px-2 sm:px-4">
      <h1 className="text-xl font-semibold mb-2">Timetable</h1>
      <p className="text-muted-foreground">
        Timetables are available on Growth and Elite plans. Contact your admin to upgrade.
      </p>
    </div>
  );
}
