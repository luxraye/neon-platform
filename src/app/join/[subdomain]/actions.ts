"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/server/db";
import { getInstitutionStaff, notifyUsers } from "@/lib/notify-dispatch";

export type JoinResult = { success: true } | { success: false; error: string };

export type PublicInstitution = {
  id: string;
  name: string;
  subdomain: string;
  primary_color: string | null;
  logo_url: string | null;
};

const MAX_REQUESTS_PER_HOUR_PER_IP = 5;

export async function getInstitutionBySubdomain(subdomain: string): Promise<PublicInstitution | null> {
  const key = subdomain?.trim().toLowerCase();
  if (!key || key.length > 40) return null;
  const { data, error } = await getDb()
    .from("institutions")
    .select("id, name, subdomain, primary_color, logo_url")
    .eq("subdomain", key)
    .maybeSingle<PublicInstitution>();
  if (error) return null;
  return data;
}

async function requesterFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`neon-join:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Public "join this centre" form. It never creates an account: it files a request that the
 * centre's headmaster approves or rejects. Approval creates the account and emails a link
 * to set a password.
 */
export async function requestToJoin(
  subdomain: string,
  formData: { email: string; full_name: string; message?: string; website?: string }
): Promise<JoinResult> {
  // Honeypot field: real people never fill it in.
  if (formData.website) return { success: true };

  const institution = await getInstitutionBySubdomain(subdomain);
  if (!institution) return { success: false, error: "Centre not found." };

  const email = formData.email?.trim().toLowerCase();
  const fullName = formData.full_name?.trim();
  const message = formData.message?.trim().slice(0, 500) || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { success: false, error: "Enter a valid email address." };
  }
  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    return { success: false, error: "Enter your full name." };
  }

  const db = getDb();
  const fingerprint = await requesterFingerprint();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await db
    .from("join_requests")
    .select("*", { count: "exact", head: true })
    .eq("requester_fingerprint", fingerprint)
    .gte("created_at", hourAgo);
  if ((recent ?? 0) >= MAX_REQUESTS_PER_HOUR_PER_IP) {
    return { success: false, error: "Too many requests. Please try again later." };
  }

  const { data: existing } = await db
    .from("join_requests")
    .select("id")
    .eq("institution_id", institution.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return { success: true };

  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("institution_id", institution.id)
    .maybeSingle();
  if (existingProfile) {
    return { success: false, error: "You already have an account here. Sign in instead." };
  }

  const { error } = await db.from("join_requests").insert({
    institution_id: institution.id,
    email,
    full_name: fullName,
    message,
    requester_fingerprint: fingerprint,
  });
  if (error) return { success: false, error: "Could not send your request. Please try again." };

  try {
    const heads = await getInstitutionStaff(institution.id, ["headmaster"]);
    await notifyUsers(
      heads.map((h) => ({ userId: h.id, email: null })),
      "New join request",
      `${fullName} (${email}) asked to join ${institution.name}. Review it under Staff.`,
      "announcement"
    );
  } catch (e) {
    console.error("[requestToJoin] notify headmasters", e);
  }

  return { success: true };
}
