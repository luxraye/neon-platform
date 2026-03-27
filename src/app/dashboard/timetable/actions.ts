"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

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
}): Promise<CreateSlotResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "headmaster" && profile?.role !== "tutor")
    return { success: false, error: "Only staff can add timetable slots." };
  if (!profile?.institution_id) return { success: false, error: "No institution." };

  const { data: row, error } = await admin
    .from("timetables")
    .insert({
      institution_id: profile.institution_id,
      cohort_id: form.cohort_id,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      subject: form.subject.trim(),
      tutor_id: user.id,
      room: form.room?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: row.id };
}

export async function deleteTimetableSlot(slotId: string): Promise<DeleteSlotResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "headmaster" && profile?.role !== "tutor")
    return { success: false, error: "Only staff can delete slots." };

  const { error } = await admin.from("timetables").delete().eq("id", slotId).eq("institution_id", profile!.institution_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
