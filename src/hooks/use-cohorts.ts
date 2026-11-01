"use client";

import { useQuery } from "@tanstack/react-query";
import { qCohorts } from "@/app/data/queries";
import { db, type CohortRecord } from "@/lib/db";

export type Cohort = {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

async function fetchCohortsFromServer(): Promise<Cohort[]> {
  return qCohorts();
}

async function persistCohortsToDexie(cohorts: Cohort[]) {
  const records: CohortRecord[] = cohorts.map((c) => ({
    ...c,
    updated_at: Date.now(),
  }));
  await db.cohorts.clear();
  if (records.length > 0) await db.cohorts.bulkPut(records);
}

async function getCohortsFromDexie(institutionId: string): Promise<Cohort[]> {
  const records = await db.cohorts
    .where("institution_id")
    .equals(institutionId)
    .toArray();
  return records.map((r) => ({
    id: r.id,
    institution_id: r.institution_id,
    name: r.name,
    description: r.description,
    created_at: r.created_at,
  }));
}

export function useCohorts(institutionId: string | null) {
  return useQuery({
    queryKey: ["cohorts", institutionId ?? ""],
    queryFn: async (): Promise<Cohort[]> => {
      if (!institutionId) return [];

      const online = typeof navigator !== "undefined" ? navigator.onLine : true;

      if (online) {
        const cohorts = await fetchCohortsFromServer();
        await persistCohortsToDexie(cohorts);
        return cohorts;
      }

      return getCohortsFromDexie(institutionId);
    },
    enabled: !!institutionId,
  });
}
