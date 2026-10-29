"use client";

import { useQuery } from "@tanstack/react-query";
import { qTimetable } from "@/app/data/queries";
import { db, type TimetableRecord } from "@/lib/db";

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

async function fetchSlotsFromServer(cohortId: string | null): Promise<TimetableSlot[]> {
  return qTimetable(cohortId);
}

async function persistSlotsToDexie(slots: TimetableSlot[]) {
  const records: TimetableRecord[] = slots.map((s) => ({
    ...s,
    updated_at: Date.now(),
  }));
  await db.timetables.clear();
  if (records.length > 0) await db.timetables.bulkPut(records);
}

async function getSlotsFromDexie(
  institutionId: string,
  cohortId: string | null
): Promise<TimetableSlot[]> {
  const collection = db.timetables.where("institution_id").equals(institutionId);
  const records = await collection.toArray();
  const filtered = cohortId ? records.filter((r) => r.cohort_id === cohortId) : records;
  return filtered.map((r) => ({
    id: r.id,
    institution_id: r.institution_id,
    cohort_id: r.cohort_id,
    day_of_week: r.day_of_week,
    start_time: r.start_time,
    end_time: r.end_time,
    subject: r.subject,
    tutor_id: r.tutor_id,
    room: r.room,
    created_at: r.created_at,
  }));
}

export function useTimetableSlots(
  institutionId: string | null,
  cohortId: string | null
) {
  return useQuery({
    queryKey: ["timetable", institutionId ?? "", cohortId ?? ""],
    queryFn: async (): Promise<TimetableSlot[]> => {
      if (!institutionId) return [];
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (online) {
        const slots = await fetchSlotsFromServer(cohortId);
        await persistSlotsToDexie(slots);
        return slots;
      }
      return getSlotsFromDexie(institutionId, cohortId);
    },
    enabled: !!institutionId,
  });
}
