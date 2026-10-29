import "server-only";

import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Server-only Firebase Admin setup.
 *
 * Credentials, in order of preference:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY: the whole service-account JSON as one string.
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 * 3. Application default credentials (automatic on Firebase App Hosting / Cloud Run).
 *
 * Everything is created lazily, so `next build` works before the config exists.
 */

let app: App | null = null;
let firestore: Firestore | null = null;

function readServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (json) {
    const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function firebaseAdminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const serviceAccount = readServiceAccount();
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    undefined;
  app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId: serviceAccount?.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket,
  });
  return app;
}

export function adminAuth(): Auth {
  return getAuth(firebaseAdminApp());
}

export function adminFirestore(): Firestore {
  if (firestore) return firestore;
  firestore = getFirestore(firebaseAdminApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

export function adminBucket() {
  return getStorage(firebaseAdminApp()).bucket();
}
