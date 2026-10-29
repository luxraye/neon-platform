import "server-only";

import { getDb } from "@/lib/server/db";

/**
 * Ownership checks for ids that arrive from the browser. Every server action that accepts
 * a cohort, student, quiz or post id must confirm it belongs to the caller's centre.
 */

export async function cohortBelongsTo(cohortId: string | null | undefined, institutionId: string) {
  if (!cohortId) return true;
  const { data } = await getDb().from("cohorts").select("institution_id").eq("id", cohortId).maybeSingle();
  return data?.institution_id === institutionId;
}

export async function profileBelongsTo(
  profileId: string | null | undefined,
  institutionId: string,
  role?: "student" | "tutor" | "headmaster"
) {
  if (!profileId) return false;
  const { data } = await getDb()
    .from("profiles")
    .select("institution_id, role, deleted_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!data || data.institution_id !== institutionId) return false;
  return role ? data.role === role : true;
}

export async function profilesBelongTo(
  profileIds: string[],
  institutionId: string,
  role?: "student" | "tutor" | "headmaster"
) {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return true;
  const { data } = await getDb().from("profiles").select("id, institution_id, role").in("id", ids);
  const rows = (data ?? []) as { id: string; institution_id: string | null; role: string }[];
  return (
    rows.length === ids.length &&
    rows.every((r) => r.institution_id === institutionId && (!role || r.role === role))
  );
}

export async function recordBelongsTo(
  table: "quizzes" | "materials" | "forum_posts" | "timetables" | "cohorts",
  id: string | null | undefined,
  institutionId: string
) {
  if (!id) return false;
  const { data } = await getDb().from(table).select("institution_id").eq("id", id).maybeSingle();
  return data?.institution_id === institutionId;
}

/** Only allow http(s) links to be stored and rendered as hrefs. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
