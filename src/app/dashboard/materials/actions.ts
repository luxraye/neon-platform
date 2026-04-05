"use server";

import { randomUUID } from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";
import { broadcastNewMaterialToStudents } from "@/lib/notify-dispatch";

const MATERIALS_BUCKET = "material-documents";

const ALLOWED_EXT = new Set(["pdf", "docx", "pptx", "jpg", "jpeg", "png"]);

function mimeForExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

export type CreateMaterialResult =
  | { success: true }
  | { success: false; error: string };

export async function createMaterial(formData: {
  title: string;
  content_url?: string;
  description?: string;
  subject?: string;
  cohort_id?: string;
}): Promise<CreateMaterialResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  if (!identity.institution_id || (identity.role !== "headmaster" && identity.role !== "tutor")) {
    return { success: false, error: "Only tutors and headmasters can add materials." };
  }

  const title = formData.title?.trim();
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  const admin = createServiceRoleClient();
  const cohortId = formData.cohort_id?.trim() || null;
  const { error } = await admin.from("materials").insert({
    institution_id: identity.institution_id,
    cohort_id: cohortId,
    title,
    content_url: formData.content_url?.trim() || null,
    description: formData.description?.trim() || null,
    subject: formData.subject?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await broadcastNewMaterialToStudents(identity.institution_id, cohortId, title);
  } catch (e) {
    console.error("[createMaterial] notify students", e);
  }

  return { success: true };
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Upload a file to the `material-documents` bucket and create a materials row (create bucket in Supabase Storage if missing). */
export async function uploadMaterialDocument(formData: FormData): Promise<CreateMaterialResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  if (!identity.institution_id || (identity.role !== "headmaster" && identity.role !== "tutor")) {
    return { success: false, error: "Only tutors and headmasters can add materials." };
  }

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please choose a file." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "File is too large (max 50 MB)." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) {
    return {
      success: false,
      error: "Allowed types: PDF, Word (.docx), PowerPoint (.pptx), JPEG, PNG.",
    };
  }

  const subject = (formData.get("subject") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const cohortRaw = (formData.get("cohort_id") as string | null)?.trim();
  const cohort_id = cohortRaw && cohortRaw !== "none" ? cohortRaw : null;

  const admin = createServiceRoleClient();
  const path = `${identity.institution_id}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = file.type && file.type !== "application/octet-stream" ? file.type : mimeForExt(ext);

  const { error: uploadError } = await admin.storage.from(MATERIALS_BUCKET).upload(path, buf, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: urlData } = admin.storage.from(MATERIALS_BUCKET).getPublicUrl(path);
  const content_url = urlData.publicUrl;

  const { error } = await admin.from("materials").insert({
    institution_id: identity.institution_id,
    cohort_id,
    title,
    content_url,
    description,
    subject,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    await broadcastNewMaterialToStudents(identity.institution_id, cohort_id, title);
  } catch (e) {
    console.error("[uploadMaterialDocument] notify students", e);
  }

  return { success: true };
}

export type DeleteMaterialResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteMaterial(materialId: string): Promise<DeleteMaterialResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  if (!identity.institution_id || (identity.role !== "headmaster" && identity.role !== "tutor")) {
    return { success: false, error: "Only tutors and headmasters can remove materials." };
  }

  const admin = createServiceRoleClient();
  const { data: row, error: fetchErr } = await admin
    .from("materials")
    .select("id, institution_id")
    .eq("id", materialId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { success: false, error: fetchErr?.message ?? "Material not found." };
  }
  if (row.institution_id !== identity.institution_id) {
    return { success: false, error: "You cannot delete this material." };
  }

  const { error } = await admin.from("materials").delete().eq("id", materialId);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
