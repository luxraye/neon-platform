import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

export type UserIdentity = {
  user: {
    id: string;
    email: string | null;
    user_metadata: Record<string, unknown>;
  };
  /** Normalized lowercase role */
  role: string | null;
  institution_id: string | null;
  deleted_at: string | null;
  institution_name: string | null;
  institution_primary_color: string | null;
  institution_logo_url: string | null;
  /** Latest profile row from DB (after sync heal when applicable). */
  profile: ProfileRow | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  institution_id: string | null;
  cohort_id: string | null;
  deleted_at: string | null;
  full_name: string | null;
  email: string | null;
};

function normalizeRole(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v.length ? v : null;
}

/**
 * Single server-side source of truth for auth + role + institution.
 * Uses the service role for profile reads and synchronous upserts so metadata and `profiles`
 * stay aligned without relying on triggers or split-brain RLS for server code.
 */
export async function getUserIdentity(): Promise<UserIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaRole = normalizeRole(meta.role);
  const metaInstitutionId = typeof meta.institution_id === "string" ? meta.institution_id : null;
  const metaFullName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;

  const admin = createServiceRoleClient();

  let profile = await admin
    .from("profiles")
    .select("id, role, institution_id, cohort_id, deleted_at, full_name, email")
    .eq("id", user.id)
    .maybeSingle()
    .then((res) => res.data as ProfileRow | null);

  const profileRole = profile?.role ? normalizeRole(profile.role) : null;
  const profileInstitutionId = profile?.institution_id ?? null;

  const mergedRole = profileRole ?? metaRole;
  const mergedInstitutionId = profileInstitutionId ?? metaInstitutionId;

  const profileMissing = !profile;
  const institutionMismatch =
    profile && metaInstitutionId != null && profileInstitutionId !== metaInstitutionId;
  const roleMismatch = profile && metaRole != null && profileRole !== metaRole;

  const shouldHeal =
    !!mergedRole && (profileMissing || institutionMismatch || roleMismatch);

  if (shouldHeal) {
    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? profile?.email ?? null,
        role: mergedRole,
        institution_id: mergedInstitutionId ?? null,
        full_name: profile?.full_name ?? metaFullName ?? null,
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("[getUserIdentity] sync heal failed:", upsertError.message);
    } else {
      profile = await admin
        .from("profiles")
        .select("id, role, institution_id, cohort_id, deleted_at, full_name, email")
        .eq("id", user.id)
        .maybeSingle()
        .then((res) => res.data as ProfileRow | null);
    }
  }

  const role = profile?.role ? normalizeRole(profile.role) : mergedRole;
  const institution_id = profile?.institution_id ?? mergedInstitutionId ?? null;
  const deleted_at = profile?.deleted_at ?? null;

  let institution_name: string | null = null;
  let institution_primary_color: string | null = null;
  let institution_logo_url: string | null = null;
  if (institution_id) {
    const { data: inst } = await admin
      .from("institutions")
      .select("name, primary_color, logo_url")
      .eq("id", institution_id)
      .maybeSingle();
    institution_name = inst?.name ?? null;
    institution_primary_color = inst?.primary_color ?? null;
    institution_logo_url = inst?.logo_url ?? null;
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      user_metadata: meta,
    },
    role,
    institution_id,
    deleted_at,
    institution_name,
    institution_primary_color,
    institution_logo_url,
    profile,
  };
}

/**
 * Server layout guard: redirect if not authenticated or role not allowed.
 */
export async function requireRole(allowedRoles: string[]): Promise<UserIdentity> {
  const identity = await getUserIdentity();
  const allowed = new Set(allowedRoles.map((r) => r.toLowerCase()));
  const r = identity?.role?.toLowerCase() ?? null;
  if (!identity || !r || !allowed.has(r)) {
    redirect("/unauthorized");
  }
  return identity;
}
