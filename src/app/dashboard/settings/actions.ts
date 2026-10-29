"use server";

import { getDb } from "@/lib/server/db";
import { getActor } from "@/lib/auth/identity";
import { updateAuthUser } from "@/lib/server/auth-admin";
import { uploadFile } from "@/lib/server/storage";
import { getEffectiveTier } from "@/lib/billing";

export type UpdateBrandingResult = { success: true } | { success: false; error: string };
export type UpdateAccountResult = { success: true } | { success: false; error: string };

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function updateMyAccountProfile(formData: {
  full_name?: string;
  avatar_url?: string;
}): Promise<UpdateAccountResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Not authenticated." };

  const full_name = formData.full_name?.trim().slice(0, 120) || null;
  const avatar_url = formData.avatar_url?.trim() || null;
  if (avatar_url && !/^https:\/\//i.test(avatar_url)) {
    return { success: false, error: "Profile photo must be an https link." };
  }

  const { error } = await getDb()
    .from("profiles")
    .update({ full_name, avatar_url })
    .eq("id", actor.user.id);
  if (error) return { success: false, error: error.message };

  const { error: authErr } = await updateAuthUser(actor.user.id, { fullName: full_name });
  if (authErr) return { success: false, error: authErr.message };

  return { success: true };
}

export async function changeMyPassword(formData: {
  new_password: string;
  confirm_password: string;
}): Promise<UpdateAccountResult> {
  const actor = await getActor();
  if (!actor) return { success: false, error: "Not authenticated." };

  const p1 = formData.new_password ?? "";
  const p2 = formData.confirm_password ?? "";
  if (p1.length < 8) return { success: false, error: "Password must be at least 8 characters." };
  if (p1 !== p2) return { success: false, error: "Passwords do not match." };

  // Changing the password signs out other devices; this one keeps its session cookie
  // until it expires, which is the expected behaviour for "change password".
  const { error } = await updateAuthUser(actor.user.id, { password: p1 });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function updateInstitutionBranding(formData: {
  primary_color?: string;
  logo_file?: File;
}): Promise<UpdateBrandingResult> {
  const actor = await getActor(["headmaster"]);
  if (!actor?.institution_id) return { success: false, error: "Only headmasters can update branding." };

  const db = getDb();
  const { data: inst } = await db
    .from("institutions")
    .select("subscription_tier, is_trial")
    .eq("id", actor.institution_id)
    .single();
  if (getEffectiveTier(inst?.subscription_tier, inst?.is_trial) !== "elite") {
    return { success: false, error: "Custom branding is only available on the Elite plan." };
  }

  const updates: { primary_color?: string; logo_url?: string } = {};

  if (formData.primary_color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(formData.primary_color)) {
      return { success: false, error: "Choose a colour in #RRGGBB format." };
    }
    updates.primary_color = formData.primary_color;
  }

  const file = formData.logo_file;
  if (file && file.size > 0) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) return { success: false, error: "Logo must be PNG, JPG, WEBP or SVG." };
    if (file.size > MAX_LOGO_BYTES) return { success: false, error: "Logo must be 2 MB or smaller." };
    const { url, error } = await uploadFile(
      `institution-logos/${actor.institution_id}/logo.${ext}`,
      await file.arrayBuffer(),
      file.type,
      { overwrite: true }
    );
    if (error || !url) return { success: false, error: error?.message ?? "Upload failed." };
    updates.logo_url = url;
  }

  if (Object.keys(updates).length === 0) return { success: true };

  const { error } = await db.from("institutions").update(updates).eq("id", actor.institution_id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
