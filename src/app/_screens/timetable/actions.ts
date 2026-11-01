"use server";

import { getActor } from "@/lib/auth/identity";
import { cohortBelongsTo, profileBelongsTo } from "@/lib/server/guards";
import { getDb } from "@/lib/server/db";

export type TimetableSlot = {
  id: string;
  institution_id: string;
  cohort_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  tutor_id: string | null;
  room: string | null;
  created_at: string;
};

export type CreateSlotResult = { success: true; id: string } | { success: false; error: string };
export type DeleteSlotResult = { success: true } | { success: false; error: string };

export async function createTimetableSlot(form: {
  cohort_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string;
  room?: string;
  tutor_id?: string | null;
}): Promise<CreateSlotResult> {
  const actor = await getActor(["headmaster", "tutor"]);
  if (!actor?.institution_id) return { success: false, error: "Only staff can add timetable slots." };

  const day = Number(form.day_of_week);
  const timeOk = (t: string) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t ?? "");
  if (!Number.isInteger(day) || day < 1 || day > 7) return { success: false, error: "Choose a valid day." };
  if (!timeOk(form.start_time) || !timeOk(form.end_time)) return { success: false, error: "Enter valid times." };
  if (form.end_time <= form.start_time) return { success: false, error: "End time must be after start time." };
  if (!form.subject?.trim()) return { success: false, error: "Subject is required." };
  if (!form.cohort_id || !(await cohortBelongsTo(form.cohort_id, actor.institution_id))) {
    return { success: false, error: "Choose a cohort from your centre." };
  }

  // Headmasters can put any of their tutors on a slot; tutors always book themselves.
  let tutorId = actor.user.id;
  if (actor.role === "headmaster" && form.tutor_id) {
    if (!(await profileBelongsTo(form.tutor_id, actor.institution_id, "tutor"))) {
      return { success: false, error: "Choose a tutor from your centre." };
    }
    tutorId = form.tutor_id;
  }

  const admin = getDb();

  const { data: row, error } = await admin
    .from("timetables")
    .insert({
      institution_id: actor.institution_id,
      cohort_id: form.cohort_id,
      day_of_week: day,
      start_time: form.start_time,
      end_time: form.end_time,
      subject: form.subject.trim(),
      tutor_id: tutorId,
      room: form.room?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: row.id };
}

export async function deleteTimetableSlot(slotId: string): Promise<DeleteSlotResult> {
  const actor = await getActor(["headmaster", "tutor"]);
  if (!actor?.institution_id) return { success: false, error: "Only staff can delete slots." };

  const { error } = await getDb()
    .from("timetables")
    .delete()
    .eq("id", slotId)
    .eq("institution_id", actor.institution_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
