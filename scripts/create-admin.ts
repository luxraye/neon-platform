/**
 * Creates (or promotes) a Neon platform admin.
 *
 *   npm run create-admin -- --email you@example.com [--password "..."] [--name "Your Name"]
 *
 * Without --password a random one is generated and printed once.
 */
import { arg, ensureUser, put, randomPassword } from "./_firebase";

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run create-admin -- --email you@example.com [--password ...] [--name ...]");
    process.exit(1);
  }
  const password = arg("password") || randomPassword();
  const name = arg("name") ?? null;

  const { uid, created } = await ensureUser(email, password, name ?? undefined);
  await put("profiles", { email, role: "admin", full_name: name, institution_id: null }, uid);

  console.log(`${created ? "Created" : "Updated"} admin ${email}`);
  console.log(`Password: ${password}`);
  console.log("Sign in at /login, then you'll land on /admin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
