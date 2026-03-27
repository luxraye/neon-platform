/**
 * Repair a headmaster profile link to an institution.
 *
 * Usage:
 *   node scripts/repair-headmaster-link.cjs <email> [institution_id_or_subdomain]
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing .env.local at", ENV_PATH);
    process.exit(1);
  }
  fs.readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) return;
      process.env[m[1].trim()] = m[2].trim().replace(/^[\"']|[\"']$/g, "");
    });
}

async function main() {
  const email = process.argv[2];
  const instArg = process.argv[3]; // optional: institution_id or subdomain
  if (!email) {
    console.error("Usage: node scripts/repair-headmaster-link.cjs <email> [institution_id_or_subdomain]");
    process.exit(1);
  }

  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Find auth user by email
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("auth.admin.listUsers failed:", listErr.message);
    process.exit(1);
  }
  const user = (list.users || []).find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error("No auth user found for email:", email);
    process.exit(1);
  }

  // Resolve institution id
  let institutionId = null;
  if (instArg) {
    if (instArg.includes("-")) {
      // likely uuid
      institutionId = instArg;
    } else {
      // treat as subdomain
      const { data: inst, error: instErr } = await admin
        .from("institutions")
        .select("id, name, subdomain, created_at")
        .eq("subdomain", instArg.toLowerCase())
        .maybeSingle();
      if (instErr) {
        console.error("Failed to lookup institution by subdomain:", instErr.message);
        process.exit(1);
      }
      if (!inst) {
        console.error("No institution found for subdomain:", instArg);
        process.exit(1);
      }
      institutionId = inst.id;
    }
  } else {
    const { data: institutions, error: instsErr } = await admin
      .from("institutions")
      .select("id, name, subdomain, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (instsErr) {
      console.error("Failed to list institutions:", instsErr.message);
      process.exit(1);
    }

    if (!institutions || institutions.length === 0) {
      console.error("No institutions exist. Provision one first.");
      process.exit(1);
    }

    if (institutions.length === 1) {
      institutionId = institutions[0].id;
      console.log("Auto-selected only institution:", institutions[0].name, `(${institutions[0].subdomain})`, institutionId);
    } else {
      console.error("Multiple institutions found. Re-run with institution_id or subdomain as 2nd arg.");
      console.error("Recent institutions:");
      institutions.forEach((i) => {
        console.error(`- ${i.name} (${i.subdomain})  id=${i.id}  created_at=${i.created_at}`);
      });
      process.exit(1);
    }
  }

  // Ensure/update profile
  const meta = user.user_metadata || {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name : null;

  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      institution_id: institutionId,
      role: "headmaster",
      full_name: fullName,
    },
    { onConflict: "id" }
  );
  if (upsertErr) {
    console.error("profiles upsert failed:", upsertErr.message);
    process.exit(1);
  }

  // Also update auth metadata so future trigger/profile repairs are consistent
  const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, institution_id: institutionId, role: "headmaster" },
  });
  if (metaErr) {
    console.error("auth.admin.updateUserById metadata update failed:", metaErr.message);
    process.exit(1);
  }

  console.log("Repaired headmaster link:");
  console.log("- user_id:", user.id);
  console.log("- email:", user.email);
  console.log("- institution_id:", institutionId);
  console.log("Done. Ask them to log out and log back in.");
}

main().catch((e) => {
  console.error("Unexpected error:", e?.message || e);
  process.exit(1);
});

