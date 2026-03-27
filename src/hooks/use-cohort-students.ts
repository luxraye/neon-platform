"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";

export type CohortStudent = {
  id: string;
  email: string;
  full_name: string | null;
  cohort_id: string | null;
};

export function useCohortStudents(
  institutionId: string | null,
  cohortId: string | null
) {
  const supabase = createBrowserSupabaseClient();
  return useQuery({
    queryKey: ["cohort-students", institutionId ?? "", cohortId ?? ""],
    queryFn: async (): Promise<CohortStudent[]> => {
      if (!institutionId || !cohortId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, cohort_id")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .eq("cohort_id", cohortId)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as CohortStudent[];
    },
    enabled: !!institutionId && !!cohortId,
  });
}
