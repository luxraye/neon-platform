"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseClientApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables.");
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

/**
 * Browser auth is only used to exchange a password for an ID token. The server then keeps
 * the session in an httpOnly cookie, so nothing is persisted in the browser.
 */
export async function firebaseClientAuth(): Promise<Auth> {
  if (auth) return auth;
  auth = getAuth(firebaseClientApp());
  await setPersistence(auth, inMemoryPersistence);
  return auth;
}
