"use server";

import { getDb } from "@/lib/server/db";
import { getActor } from "@/lib/auth/identity";
import { cohortBelongsTo, profilesBelongTo } from "@/lib/server/guards";

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
  const identity = await getActor();
  if (!identity) return { success: false, error: "Not authenticated." };

  const admin = getDb();
  if (identity.role !== "headmaster" && identity.role !== "tutor")
    return { success: false, error: "Only staff can save attendance." };
  if (!identity.institution_id) return { success: false, error: "No institution." };
  if (!cohortId || !(await cohortBelongsTo(cohortId, identity.institution_id))) {
    return { success: false, error: "Choose a cohort from your centre." };
  }
  if (!Array.isArray(entries) || entries.length > 500) {
    return { success: false, error: "Too many attendance rows." };
  }
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) return { success: false, error: "Invalid date." };
    if (!["present", "absent", "late"].includes(e.status)) return { success: false, error: "Invalid status." };
  }
  if (!(await profilesBelongTo(entries.map((e) => e.student_id), identity.institution_id, "student"))) {
    return { success: false, error: "Some students are not in your centre." };
  }

  for (const e of entries) {
    const { error } = await admin.from("attendance").upsert(
      {
        institution_id: identity.institution_id,
        cohort_id: cohortId,
        student_id: e.student_id,
        date: e.date,
        status: e.status,
        remarks: e.remarks?.trim().slice(0, 500) || null,
      },
      { onConflict: "student_id,date" }
    );
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}
