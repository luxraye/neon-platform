"use server";

import { createServiceRoleClient } from "@/utils/supabase/admin";

export type JoinResult =
  | { success: true }
  | { success: false; error: string };

export async function getInstitutionBySubdomain(subdomain: string) {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("institutions")
    .select("id, name, subdomain, primary_color, logo_url")
    .eq("subdomain", subdomain.toLowerCase())
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function signUpForInstitution(
  subdomain: string,
  formData: { email: string; password: string; full_name?: string }
): Promise<JoinResult> {
  const institution = await getInstitutionBySubdomain(subdomain);
  if (!institution) {
    return { success: false, error: "Institution not found." };
  }

  const email = formData.email?.trim();
  const password = formData.password;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const admin = createServiceRoleClient();

  // Pass role, full_name, institution_id in user_metadata so handle_new_user trigger creates profile (cohort_id: null).
  const { data: newUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "student",
      full_name: formData.full_name?.trim() ?? "",
      institution_id: institution.id,
    },
  });

  if (createUserError || !newUser.user) {
    return {
      success: false,
      error: createUserError?.message ?? "Failed to create account.",
    };
  }

  // If trigger did not create profile, self-heal so student can log in.
  const { data: createdProfile } = await admin
    .from("profiles")
    .select("id, institution_id, role, cohort_id")
    .eq("id", newUser.user.id)
    .maybeSingle();

  if (
    !createdProfile ||
    createdProfile.institution_id !== institution.id ||
    createdProfile.role !== "student"
  ) {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: newUser.user.id,
        institution_id: institution.id,
        email,
        role: "student",
        full_name: formData.full_name?.trim() ?? null,
        cohort_id: null,
      },
      { onConflict: "id" }
    );
    if (upsertError) {
      await admin.auth.admin.deleteUser(newUser.user.id);
      return {
        success: false,
        error: upsertError.message ?? "Failed to create profile. Check handle_new_user trigger.",
      };
    }
  }

  return { success: true };
}
