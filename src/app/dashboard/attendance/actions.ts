"use server";

import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export type AttendanceEntry = {
  student_id: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent" | "late";
  remarks?: string;
};

export type SaveAttendanceResult = { success: true } | { success: false; error: string };

export async function saveAttendance(
  cohortId: string,
  entries: AttendanceEntry[]
): Promise<SaveAttendanceResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  if (identity.role !== "headmaster" && identity.role !== "tutor")
    return { success: false, error: "Only staff can save attendance." };
  if (!identity.institution_id) return { success: false, error: "No institution." };

  for (const e of entries) {
    const { error } = await admin.from("attendance").upsert(
      {
        institution_id: identity.institution_id,
        cohort_id: cohortId,
        student_id: e.student_id,
        date: e.date,
        status: e.status,
        remarks: e.remarks ?? null,
      },
      { onConflict: "student_id,date" }
    );
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}
