/**
 * Set a user as the first platform admin (profiles.role = 'admin' + user_metadata.role).
 * Run: node scripts/set-first-admin.cjs <user_id_or_email>
 * Uses .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  fs.readFileSync(ENV_PATH, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  });
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/set-first-admin.cjs <user_id_or_email>");
  process.exit(1);
}

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

async function main() {
  let userId = input;
  let email = input;

  if (!input.includes("@")) {
    userId = input;
    const { data: u } = await supabase.auth.admin.getUserById(input);
    if (u?.user?.email) email = u.user.email;
  } else {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const u = users?.find((x) => x.email === input);
    if (!u) {
      console.error("No user found with email:", input);
      process.exit(1);
    }
    userId = u.id;
    email = u.email;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role: "admin" },
  });
  if (updateError) {
    console.error("auth.admin.updateUserById failed:", updateError.message);
    process.exit(1);
  }
  console.log("Set user_metadata.role = 'admin' for", userId);

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: email,
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
  console.log("Set profiles.role = 'admin' for", userId);
  console.log("Done. User can sign in and will be redirected to /admin.");
}

main();
