"use client";

import { useQuery } from "@tanstack/react-query";
import { qCohortStudents, type CohortStudentDto } from "@/app/data/queries";

export type CohortStudent = CohortStudentDto;

export function useCohortStudents(institutionId: string | null, cohortId: string | null) {
  return useQuery({
    queryKey: ["cohort-students", institutionId ?? "", cohortId ?? ""],
    queryFn: () => qCohortStudents(cohortId!),
    enabled: !!institutionId && !!cohortId,
  });
}
