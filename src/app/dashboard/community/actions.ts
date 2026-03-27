"use server";

import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getUserIdentity } from "@/utils/supabase/get-user-identity";

export type CreatePostResult =
  | { success: true }
  | { success: false; error: string };

export async function createPost(formData: {
  subject: string;
  title: string;
  content: string;
}): Promise<CreatePostResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }
  if (!identity.institution_id) {
    return { success: false, error: "You must belong to an institution to post." };
  }
  if (identity.role === "student" && !identity.profile?.cohort_id) {
    return { success: false, error: "You must be assigned to a cohort before using community." };
  }

  const subject = formData.subject?.trim();
  const title = formData.title?.trim();
  const content = formData.content?.trim();
  if (!subject || !title || !content) {
    return { success: false, error: "Subject, title, and content are required." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("forum_posts").insert({
    institution_id: identity.institution_id,
    author_id: identity.user.id,
    subject,
    title,
    content,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export type CreateCommentResult =
  | { success: true }
  | { success: false; error: string };

export async function createComment(formData: {
  post_id: string;
  content: string;
}): Promise<CreateCommentResult> {
  const identity = await getUserIdentity();
  if (!identity?.user) {
    return { success: false, error: "Not authenticated." };
  }

  const content = formData.content?.trim();
  if (!content || !formData.post_id) {
    return { success: false, error: "Content is required." };
  }
  if (identity.role === "student" && !identity.profile?.cohort_id) {
    return { success: false, error: "You must be assigned to a cohort before using community." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("forum_comments").insert({
    post_id: formData.post_id,
    author_id: identity.user.id,
    content,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
