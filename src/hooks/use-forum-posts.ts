"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/utils/supabase/client";
import { db, type ForumPostRecord } from "@/lib/db";

export type ForumPost = {
  id: string;
  institution_id: string;
  author_id: string;
  subject: string;
  title: string;
  content: string;
  created_at: string;
};

async function fetchPostsFromSupabase(
  institutionId: string,
  subject: string | null
): Promise<ForumPost[]> {
  const supabase = createBrowserSupabaseClient();
  let q = supabase
    .from("forum_posts")
    .select("id, institution_id, author_id, subject, title, content, created_at")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });
  if (subject) q = q.eq("subject", subject);
  const { data, error } = await q;
  if (error) throw error;
  const posts = (data ?? []) as ForumPost[];
  return posts;
}

async function persistPostsToDexie(posts: ForumPost[]) {
  const records: ForumPostRecord[] = posts.map((p) => ({
    ...p,
    updated_at: Date.now(),
  }));
  await db.forum_posts.clear();
  if (records.length > 0) await db.forum_posts.bulkPut(records);
}

async function getPostsFromDexie(
  institutionId: string,
  subject: string | null
): Promise<ForumPost[]> {
  const collection = db.forum_posts.where("institution_id").equals(institutionId);
  const records = subject
    ? await collection.filter((p) => p.subject === subject).toArray()
    : await collection.toArray();
  return records
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((r) => ({
      id: r.id,
      institution_id: r.institution_id,
      author_id: r.author_id,
      subject: r.subject,
      title: r.title,
      content: r.content,
      created_at: r.created_at,
    }));
}

export function useForumPosts(
  institutionId: string | null,
  subject: string | null
) {
  return useQuery({
    queryKey: ["forum-posts", institutionId ?? "", subject ?? ""],
    queryFn: async (): Promise<ForumPost[]> => {
      if (!institutionId) return [];

      const online = typeof navigator !== "undefined" ? navigator.onLine : true;

      if (online) {
        const posts = await fetchPostsFromSupabase(institutionId, subject);
        await persistPostsToDexie(posts);
        return posts;
      }

      return getPostsFromDexie(institutionId, subject);
    },
    enabled: !!institutionId,
  });
}
