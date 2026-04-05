"use server";

import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getAdminProfiles, notifyUsers } from "@/lib/notify-dispatch";

export type SchoolMatch = { name: string; subdomain: string } | null;

export type SubmitLeadResult = { success: true } | { success: false; error: string };

export async function submitLead(input: {
  name: string;
  email: string;
  institution_name?: string;
  message?: string;
}): Promise<SubmitLeadResult> {
  const name = input.name?.trim();
  const email = input.email?.trim();
  if (!name || !email) return { success: false, error: "Name and email are required." };

  const admin = createServiceRoleClient();

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .insert({
      name,
      email,
      institution_name: input.institution_name?.trim() || null,
      message: input.message?.trim() || null,
      status: "new",
    })
    .select("id")
    .single();

  if (leadError) return { success: false, error: leadError.message };
  if (!lead) return { success: false, error: "Failed to save lead." };

  const institutionName = input.institution_name?.trim() || "Unknown";
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
  const q = query?.trim().toLowerCase();
  if (!q) return null;

  const admin = createServiceRoleClient();

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

