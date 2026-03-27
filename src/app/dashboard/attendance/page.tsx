"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStaffRole } from "@/hooks/use-staff-role";
import { useCohorts } from "@/hooks/use-cohorts";
import { useCohortStudents } from "@/hooks/use-cohort-students";
import { useAttendanceForDate } from "@/hooks/use-attendance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveAttendance } from "./actions";
import { db } from "@/lib/db";

const STATUSES = ["present", "absent", "late"] as const;
type Status = (typeof STATUSES)[number];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { isStaff, profileData } = useStaffRole();
  const institutionId =
    profileData?.profile?.institution_id ??
    (profileData?.user?.user_metadata?.institution_id as string | undefined) ??
    null;
  const { data: cohorts } = useCohorts(institutionId);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<Record<string, Status>>({});
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});

  const { data: students, isLoading: studentsLoading } = useCohortStudents(institutionId, cohortId);
  const { data: existing, isLoading: attendanceLoading } = useAttendanceForDate(
    institutionId,
    cohortId,
    date
  );

  useEffect(() => {
    const map: Record<string, Status> = {};
    (existing ?? []).forEach((r) => {
      map[r.student_id] = r.status;
    });
    setLocalStatus(map);
  }, [existing]);

  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  const handleSave = async () => {
    if (!cohortId || !students?.length) return;
    const entries = students.map((s) => ({
      student_id: s.id,
      date,
      status: localStatus[s.id] ?? "present",
      remarks: localRemarks[s.id] || undefined,
    }));

    if (!isOnline) {
      const existingDrafts = await db.attendance_drafts
        .where("[cohort_id+date]")
        .equals([cohortId, date])
        .toArray();
      for (const d of existingDrafts) await db.attendance_drafts.delete(d.id);
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
      toast.success("Saved locally. Will sync when you're back online.");
      queryClient.invalidateQueries({ queryKey: ["attendance", institutionId ?? "", cohortId, date] });
      return;
    }

    setSaving(true);
    const result = await saveAttendance(cohortId, entries);
    setSaving(false);
    if (result.success) {
      toast.success("Attendance saved.");
      queryClient.invalidateQueries({ queryKey: ["attendance", institutionId ?? "", cohortId, date] });
    } else {
      toast.error(result.error);
    }
  };

  if (!isStaff) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Attendance</h1>
        <p className="text-muted-foreground">Only tutors and headmasters can mark attendance.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Daily Attendance</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <Label className="mr-2">Cohort</Label>
          <Select value={cohortId ?? ""} onValueChange={(v) => setCohortId(v || null)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select cohort" />
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
        <div>
          <Label className="mr-2">Date</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {studentsLoading && <p className="text-muted-foreground">Loading students…</p>}
      {!studentsLoading && cohortId && (!students?.length ? (
        <p className="text-muted-foreground">No students in this cohort. Assign students from Staff.</p>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-48">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name ?? s.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {STATUSES.map((st) => (
                          <Button
                            key={st}
                            variant={localStatus[s.id] === st ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLocalStatus((prev) => ({ ...prev, [s.id]: st }))}
                          >
                            {st.charAt(0).toUpperCase() + st.slice(1)}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={localRemarks[s.id] ?? ""}
                        onChange={(e) =>
                          setLocalRemarks((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            className="mt-4"
            onClick={handleSave}
            disabled={saving || attendanceLoading}
          >
            {saving ? "Saving…" : isOnline ? "Save Attendance" : "Save locally (offline)"}
          </Button>
        </>
      ))}
    </div>
  );
}
