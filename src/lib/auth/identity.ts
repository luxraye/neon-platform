import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/server/db";
import { getEffectiveTier } from "@/lib/billing";
import { getSessionUser } from "@/lib/auth/session";
import { SESSION_LOCK_COOKIE } from "@/lib/session-lock";

export type Role = "admin" | "headmaster" | "tutor" | "student";

export type ProfileRow = {
  id: string;
  role: string | null;
  institution_id: string | null;
  cohort_id: string | null;
  deleted_at: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
};

export type UserIdentity = {
  user: { id: string; email: string | null };
  /** Normalised lowercase role. */
  role: Role | null;
  institution_id: string | null;
  deleted_at: string | null;
  institution_name: string | null;
  institution_primary_color: string | null;
  institution_logo_url: string | null;
  profile: ProfileRow | null;
};

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v === "admin" || v === "headmaster" || v === "tutor" || v === "student" ? v : null;
}

/**
 * Single server-side source of truth for who is signed in, their role and their centre.
 * Returns null when there is no valid session, the session was replaced by a newer sign-in
 * on another device, or the profile is missing.
 */
export const getUserIdentity = cache(async (): Promise<UserIdentity | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const db = getDb();

  const store = await cookies();
  const lockToken = store.get(SESSION_LOCK_COOKIE)?.value ?? null;
  const { data: lock } = await db
    .from("user_session_locks")
    .select("lock_token")
    .eq("id", user.id)
    .maybeSingle();
  if (!lockToken || !lock?.lock_token || lock.lock_token !== lockToken) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("id, role, institution_id, cohort_id, deleted_at, full_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (!profile) return null;

  const role = normalizeRole(profile.role);
  const institution_id = profile.institution_id ?? null;

  let institution_name: string | null = null;
  let institution_primary_color: string | null = null;
  let institution_logo_url: string | null = null;
  if (institution_id) {
    const { data: inst } = await db
      .from("institutions")
      .select("name, primary_color, logo_url, subscription_tier, is_trial")
      .eq("id", institution_id)
      .maybeSingle();
    institution_name = inst?.name ?? null;
    // Custom branding is an Elite feature; other plans keep Neon's look.
    if (getEffectiveTier(inst?.subscription_tier, inst?.is_trial) === "elite") {
      const color = typeof inst?.primary_color === "string" ? inst.primary_color : "";
      institution_primary_color = /^#[0-9a-f]{6}$/i.test(color) ? color : null;
      institution_logo_url = inst?.logo_url ?? null;
    }
  }

  return {
    user: { id: user.id, email: user.email ?? profile.email ?? null },
    role,
    institution_id,
    deleted_at: profile.deleted_at ?? null,
    institution_name,
    institution_primary_color,
    institution_logo_url,
    profile,
  };
});

/** Server layout guard: redirect if not signed in or the role is not allowed. */
export async function requireRole(allowedRoles: string[]): Promise<UserIdentity> {
  const identity = await getUserIdentity();
  if (!identity) redirect("/login");
  const allowed = new Set(allowedRoles.map((r) => r.toLowerCase()));
  if (!identity.role || !allowed.has(identity.role) || identity.deleted_at) {
    redirect("/unauthorized");
  }
  return identity;
}

export type Actor = UserIdentity & { role: Role };

/**
 * For server actions and data loaders: the signed-in, active user with one of the given
 * roles, or null. Staff and students also must belong to a centre.
 */
export async function getActor(allowedRoles?: Role[]): Promise<Actor | null> {
  const identity = await getUserIdentity();
  if (!identity?.role || identity.deleted_at) return null;
  if (allowedRoles && !allowedRoles.includes(identity.role)) return null;
  if (identity.role !== "admin" && !identity.institution_id) return null;
  return identity as Actor;
}
