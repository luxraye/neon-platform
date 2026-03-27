"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import {
  FEEDBACK_SCREENSHOT_BUCKET,
  isAllowedFeedbackArea,
  isAllowedFeedbackSeverity,
  isAllowedFeedbackType,
  MAX_SCREENSHOT_MB,
} from "@/lib/feedback";

const ALLOWED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type SubmitFeedbackResult = { success: true } | { success: false; error: string };

export async function submitUserFeedback(formData: FormData): Promise<SubmitFeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.id || !profile.role) {
    return { success: false, error: "Profile not found." };
  }

  const feedbackType = String(formData.get("feedback_type") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const severity = String(formData.get("severity") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const detailsRaw = String(formData.get("details") ?? "");
  const details = detailsRaw.trim() || null;
  const screenshot = formData.get("screenshot");

  if (!isAllowedFeedbackType(feedbackType)) {
    return { success: false, error: "Please select a valid feedback type." };
  }
  if (!isAllowedFeedbackArea(area)) {
    return { success: false, error: "Please select what this feedback is about." };
  }
  if (!isAllowedFeedbackSeverity(severity)) {
    return { success: false, error: "Please select a valid severity level." };
  }
  if (!summary || summary.length < 8) {
    return { success: false, error: "Please provide a short summary (at least 8 characters)." };
  }
  if (summary.length > 240) {
    return { success: false, error: "Summary is too long (max 240 characters)." };
  }
  if (details && details.length > 3000) {
    return { success: false, error: "Details are too long (max 3000 characters)." };
  }

  if (profile.role !== "admin" && !profile.institution_id) {
    return { success: false, error: "Your account is not linked to an institution." };
  }

  let screenshotUrl: string | null = null;
  if (screenshot instanceof File && screenshot.size > 0) {
    if (!ALLOWED_SCREENSHOT_TYPES.includes(screenshot.type)) {
      return { success: false, error: "Screenshot must be PNG, JPG, or WEBP." };
    }
    const maxBytes = MAX_SCREENSHOT_MB * 1024 * 1024;
    if (screenshot.size > maxBytes) {
      return { success: false, error: `Screenshot is too large (max ${MAX_SCREENSHOT_MB}MB).` };
    }
    const ext = screenshot.type === "image/png" ? "png" : screenshot.type === "image/webp" ? "webp" : "jpg";
    const institutionPart = profile.institution_id ?? "platform";
    const path = `${institutionPart}/${profile.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await screenshot.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(FEEDBACK_SCREENSHOT_BUCKET)
      .upload(path, buffer, { contentType: screenshot.type, upsert: false });
    if (uploadError) {
      return { success: false, error: uploadError.message };
    }
    const { data: urlData } = admin.storage.from(FEEDBACK_SCREENSHOT_BUCKET).getPublicUrl(path);
    screenshotUrl = urlData.publicUrl;
  }

  const { error: insertError } = await admin.from("user_feedback").insert({
    institution_id: profile.role === "admin" ? null : profile.institution_id,
    created_by: profile.id,
    feedback_type: feedbackType,
    area,
    severity,
    summary,
    details,
    screenshot_url: screenshotUrl,
    status: "new",
  });
  if (insertError) return { success: false, error: insertError.message };

  return { success: true };
}
