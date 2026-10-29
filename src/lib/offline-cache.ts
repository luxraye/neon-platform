"use client";

import { db } from "@/lib/db";

/** Wipes the offline copy of centre data, so the next person on this device starts clean. */
export async function clearOfflineCache() {
  try {
    await Promise.all(db.tables.map((t) => t.clear()));
  } catch {
    // IndexedDB may be unavailable (private mode); nothing to clear.
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}
