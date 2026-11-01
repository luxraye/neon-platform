"use client";

import { useQuery } from "@tanstack/react-query";
import { qAttendance } from "@/app/data/queries";
import { db } from "@/lib/db";

export type AttendanceRow = {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent" | "late";
  remarks: string | null;
};

export function useAttendanceForDate(
  institutionId: string | null,
  cohortId: string | null,
  date: string
) {

  return useQuery({
    queryKey: ["attendance", institutionId ?? "", cohortId ?? "", date],
    queryFn: async (): Promise<AttendanceRow[]> => {
      if (!institutionId || !cohortId) return [];
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (online) {
        return qAttendance(cohortId, date);
      }
      const drafts = await db.attendance_drafts
        .where("[cohort_id+date]")
        .equals([cohortId, date])
        .toArray();
      return drafts.map((d) => ({
        id: d.id,
        student_id: d.student_id,
        date: d.date,
        status: d.status,
        remarks: d.remarks,
      }));
    },
    enabled: !!institutionId && !!cohortId && !!date,
  });
}
