"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/server/db";
import { getAdminProfiles, notifyUsers } from "@/lib/notify-dispatch";

export type SchoolMatch = { name: string; subdomain: string } | null;

export type SubmitLeadResult = { success: true } | { success: false; error: string };

export async function submitLead(input: {
  name: string;
  email: string;
  phone?: string;
  institution_name?: string;
  message?: string;
  plan?: string;
  /** Honeypot: hidden from people, filled in by bots. */
  website?: string;
}): Promise<SubmitLeadResult> {
  if (input.website) return { success: true };
  const name = input.name?.trim().slice(0, 120);
  const email = input.email?.trim().toLowerCase().slice(0, 200);
  if (!name || !email) return { success: false, error: "Name and email are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid email address." };

  const admin = getDb();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const fingerprint = createHash("sha256").update(`neon-lead:${ip}`).digest("hex").slice(0, 32);
  const { count: recent } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("requester_fingerprint", fingerprint)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((recent ?? 0) >= 5) return { success: false, error: "Too many requests. Please try again later." };

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .insert({
      name,
      email,
      phone: input.phone?.trim().slice(0, 40) || null,
      institution_name: input.institution_name?.trim().slice(0, 160) || null,
      message: input.message?.trim().slice(0, 2000) || null,
      plan: ["starter", "growth", "elite"].includes(input.plan ?? "") ? input.plan : null,
      requester_fingerprint: fingerprint,
      status: "new",
    })
    .select("id")
    .single();

  if (leadError) return { success: false, error: leadError.message };
  if (!lead) return { success: false, error: "Failed to save lead." };

  const institutionName = input.institution_name?.trim() || "Unknown centre";
  const admins = await getAdminProfiles();
  if (admins.length) {
    const msg = `New lead from ${name} (${email}) — ${institutionName}.${input.message?.trim() ? ` Message: ${input.message.trim()}` : ""}`;
    try {
      await notifyUsers(
        admins.map((a) => ({ userId: a.id, email: a.email ?? null })),
        "New lead",
        msg,
        "announcement"
      );
    } catch (e) {
      console.error("[submitLead] notify admins", e);
    }
  }

  return { success: true };
}

export async function findSchool(query: string): Promise<SchoolMatch> {
  const q = query?.trim().toLowerCase().replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || q.length < 2 || q.length > 80) return null;

  const admin = getDb();

  // Try exact subdomain match first.
  const { data: exact } = await admin
    .from("institutions")
    .select("name, subdomain")
    .eq("subdomain", q)
    .maybeSingle();
  if (exact?.subdomain) return exact as { name: string; subdomain: string };

  // Then fuzzy name/subdomain match (best-effort).
  const { data } = await admin
    .from("institutions")
    .select("name, subdomain")
    .or(`name.ilike.%${q}%,subdomain.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const first = (data ?? [])[0];
  return first ? (first as { name: string; subdomain: string }) : null;
}

