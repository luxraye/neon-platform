"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
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
  const queryClient = useQueryClient();
  const supabase = createBrowserSupabaseClient();

  return useQuery({
    queryKey: ["attendance", institutionId ?? "", cohortId ?? "", date],
    queryFn: async (): Promise<AttendanceRow[]> => {
      if (!institutionId || !cohortId) return [];
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (online) {
        const { data, error } = await supabase
          .from("attendance")
          .select("id, student_id, date, status, remarks")
          .eq("institution_id", institutionId)
          .eq("cohort_id", cohortId)
          .eq("date", date);
        if (error) throw error;
        return (data ?? []) as AttendanceRow[];
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
