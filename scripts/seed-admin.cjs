/**
 * One-off script: set giftjrnakedi@gmail.com as admin and create one institution.
 * Run from project root: node scripts/seed-admin.cjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing .env.local. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const content = fs.readFileSync(ENV_PATH, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  });
}

const ADMIN_EMAIL = "giftjrnakedi@gmail.com";
const TEMP_PASSWORD = "ChangeMe123!";

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Find or create user
  let userId;
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("listUsers failed:", listError.message);
    process.exit(1);
  }
  const existing = users?.find((u) => u.email === ADMIN_EMAIL);

  if (existing) {
    userId = existing.id;
    console.log("Found existing user:", ADMIN_EMAIL, userId);
  } else {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    if (createError) {
      console.error("createUser failed:", createError.message);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log("Created user:", ADMIN_EMAIL, "— temporary password:", TEMP_PASSWORD);
  }

  // Upsert profile as admin (no institution = platform admin)
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      role: "admin",
      full_name: "Platform Admin",
      institution_id: null,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    console.error("profiles upsert failed:", profileError.message);
    process.exit(1);
  }
  console.log("Profile set to role: admin");

  // Create one institution
  const { data: inst, error: instError } = await supabase
    .from("institutions")
    .insert({
      name: "Neon Demo Institution",
      subdomain: "demo",
      subscription_tier: "starter",
      is_trial: true,
    })
    .select("id, name, subdomain")
    .single();
  if (instError) {
    if (instError.code === "23505") {
      console.log("Institution with subdomain 'demo' already exists; skipping.");
    } else {
      console.error("institutions insert failed:", instError.message);
      process.exit(1);
    }
  } else {
    console.log("Created institution:", inst.name, "— subdomain:", inst.subdomain);
  }

  if (existing) {
    console.log("Done. Sign in at /login with", ADMIN_EMAIL, "and your existing password.");
  } else {
    console.log("Done. Sign in at /login with", ADMIN_EMAIL, "and password:", TEMP_PASSWORD, "(change it after first login).");
  }
}

main();
