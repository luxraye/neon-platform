"use server";

import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getEffectiveTier } from "@/lib/billing";

export type UpdateBrandingResult = { success: true } | { success: false; error: string };
export type UpdateAccountResult = { success: true } | { success: false; error: string };

const BUCKET = "institution-logos";

export async function updateMyAccountProfile(formData: {
  full_name?: string;
  avatar_url?: string;
}): Promise<UpdateAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const full_name = formData.full_name?.trim() || null;
  const avatar_url = formData.avatar_url?.trim() || null;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name, avatar_url })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  // Keep auth metadata aligned for UI fallbacks.
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      full_name: full_name ?? "",
    },
  });
  if (authErr) return { success: false, error: authErr.message };

  return { success: true };
}

export async function changeMyPassword(formData: {
  new_password: string;
  confirm_password: string;
}): Promise<UpdateAccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const p1 = formData.new_password ?? "";
  const p2 = formData.confirm_password ?? "";
  if (p1.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (p1 !== p2) {
    return { success: false, error: "Passwords do not match." };
  }

  const { error } = await supabase.auth.updateUser({ password: p1 });
  if (error) return { success: false, error: error.message };

  return { success: true };
}

export async function updateInstitutionBranding(formData: {
  primary_color?: string;
  logo_file?: File;
}): Promise<UpdateBrandingResult> {
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
  if (profile?.role !== "headmaster" || !profile?.institution_id)
    return { success: false, error: "Only headmasters can update branding." };

  const { data: inst } = await admin
    .from("institutions")
    .select("subscription_tier, is_trial")
    .eq("id", profile.institution_id)
    .single();
  if (getEffectiveTier(inst?.subscription_tier, inst?.is_trial) !== "elite")
    return { success: false, error: "Custom branding is only available on the Elite plan." };

  let logoUrl: string | null = null;
  const file = formData.logo_file;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.institution_id}/logo.${ext}`;
    const buf = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, buf, { upsert: true, contentType: file.type });
    if (uploadError) return { success: false, error: uploadError.message };
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    logoUrl = urlData.publicUrl;
  }

  const updates: { primary_color?: string; logo_url?: string } = {};
  if (formData.primary_color !== undefined) updates.primary_color = formData.primary_color;
  if (logoUrl !== null) updates.logo_url = logoUrl;

  if (Object.keys(updates).length === 0) return { success: true };

  const { error } = await admin
    .from("institutions")
    .update(updates)
    .eq("id", profile.institution_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
