import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/session-lock";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

/**
 * The signed-in user for this request, from the Firebase session cookie.
 * Checks revocation, so a disabled or signed-out account stops working at once.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      id: decoded.uid,
      email: decoded.email ?? null,
      displayName: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
});
