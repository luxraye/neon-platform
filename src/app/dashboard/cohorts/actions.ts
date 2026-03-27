"use server";

import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export type CreateCohortResult =
  | { success: true }
  | { success: false; error: string };

export async function createCohort(formData: {
  name: string;
  description?: string;
}): Promise<CreateCohortResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createServiceRoleClient();
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { success: false, error: "Only tutors and headmasters can create cohorts." };
  }

  const name = formData.name?.trim();
  if (!name) {
    return { success: false, error: "Name is required." };
  }

  const { error } = await admin.from("cohorts").insert({
    institution_id: identity.institution_id,
    name,
    description: formData.description?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export type CohortRow = {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

/** Returns cohorts for the current user's institution when headmaster so RLS doesn't hide them. */
export async function getCohorts(): Promise<CohortRow[]> {
  const identity = await getUserIdentity();
  if (!identity?.user) return [];

  const admin = createServiceRoleClient();
  if (identity.role !== "headmaster" && identity.role !== "tutor") {
    return [];
  }

  const { data } = await admin
    .from("cohorts")
    .select("id, institution_id, name, description, created_at")
    .eq("institution_id", identity.institution_id)
    .order("created_at", { ascending: false });

  return (data ?? []) as CohortRow[];
}

export type UpdateCohortResult =
  | { success: true }
  | { success: false; error: string };

export async function updateCohort(
  cohortId: string,
  formData: { name: string; description?: string }
): Promise<UpdateCohortResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createServiceRoleClient();
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { success: false, error: "Only tutors and headmasters can edit cohorts." };
  }

  const name = formData.name?.trim();
  if (!name) {
    return { success: false, error: "Name is required." };
  }

  const { data: row, error: fetchErr } = await admin
    .from("cohorts")
    .select("id, institution_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { success: false, error: fetchErr?.message ?? "Cohort not found." };
  }
  if (row.institution_id !== identity.institution_id) {
    return { success: false, error: "You cannot edit this cohort." };
  }

  const { error } = await admin
    .from("cohorts")
    .update({
      name,
      description: formData.description?.trim() || null,
    })
    .eq("id", cohortId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export type DeleteCohortResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteCohort(cohortId: string): Promise<DeleteCohortResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  const admin = createServiceRoleClient();
  if (
    (identity.role !== "headmaster" && identity.role !== "tutor") ||
    !identity.institution_id
  ) {
    return { success: false, error: "Only tutors and headmasters can delete cohorts." };
  }

  const { data: row, error: fetchErr } = await admin
    .from("cohorts")
    .select("id, institution_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { success: false, error: fetchErr?.message ?? "Cohort not found." };
  }
  if (row.institution_id !== identity.institution_id) {
    return { success: false, error: "You cannot delete this cohort." };
  }

  const { error } = await admin.from("cohorts").delete().eq("id", cohortId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
