/**
 * Shared setup for the one-off scripts in this folder. Reads `.env.local`, connects with the
 * same credentials the app uses, and writes documents the way the app's data layer does
 * (every optional field present as null, plus `id` and `created_at`).
 */
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTION_DEFAULTS, HAS_CREATED_AT, type CollectionName } from "../src/lib/server/schema";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function credential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (json) {
    const p = JSON.parse(json);
    return cert({ projectId: p.project_id, clientEmail: p.client_email, privateKey: p.private_key });
  }
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }
  return applicationDefault();
}

const app = initializeApp({
  credential: credential(),
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

/** Creates or replaces one document with the collection's defaults filled in. Returns its id. */
export async function put(collection: CollectionName, data: Record<string, unknown>, id: string = randomUUID()) {
  const doc: Record<string, unknown> = { ...COLLECTION_DEFAULTS[collection], ...data, id };
  if (HAS_CREATED_AT.has(collection) && !doc.created_at) doc.created_at = new Date().toISOString();
  await db.collection(collection).doc(id).set(doc);
  return id;
}

/** Finds a sign-in account by email or creates it. Returns the uid. */
export async function ensureUser(email: string, password: string, displayName?: string) {
  try {
    const u = await auth.getUserByEmail(email);
    await auth.updateUser(u.uid, { password, displayName });
    return { uid: u.uid, created: false };
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    const u = await auth.createUser({ email, password, displayName, emailVerified: true });
    return { uid: u.uid, created: true };
  }
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function randomPassword() {
  return randomUUID().replace(/-/g, "").slice(0, 14);
}
