import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getDb } from "@/lib/server/db";
import { normalizeRole } from "@/lib/auth/identity";
import { SESSION_COOKIE, SESSION_LOCK_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-lock";

export const dynamic = "force-dynamic";

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Exchanges a fresh Firebase ID token for an httpOnly session cookie and claims the
 * single-device session lock. Responds with the user's home path.
 */
export async function POST(request: Request) {
  let idToken: string | undefined;
  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    // handled below
  }
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "Missing sign-in token." }, { status: 400 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }

    const db = getDb();
    const { data: profile } = await db
      .from("profiles")
      .select("role, deleted_at")
      .eq("id", decoded.uid)
      .maybeSingle();
    const role = normalizeRole(profile?.role);
    if (!profile || !role) {
      return NextResponse.json(
        { ok: false, error: "This account is not set up in Neon yet. Contact your centre." },
        { status: 403 }
      );
    }
    if (profile.deleted_at) {
      return NextResponse.json(
        { ok: false, error: "This account has been removed. Contact your centre." },
        { status: 403 }
      );
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const lockToken = randomUUID();
    const now = new Date().toISOString();
    const { error: lockError } = await db
      .from("user_session_locks")
      .upsert({ user_id: decoded.uid, lock_token: lockToken, last_seen: now, updated_at: now });
    if (lockError) {
      return NextResponse.json({ ok: false, error: "Could not secure this session." }, { status: 500 });
    }

    const home = role === "admin" ? "/admin" : `/${role}`;
    const response = NextResponse.json({ ok: true, home });
    response.cookies.set({ name: SESSION_COOKIE, value: sessionCookie, maxAge: SESSION_MAX_AGE_SECONDS, ...cookieBase });
    response.cookies.set({ name: SESSION_LOCK_COOKIE, value: lockToken, maxAge: SESSION_MAX_AGE_SECONDS, ...cookieBase });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Sign-in failed. Please try again." }, { status: 401 });
  }
}

/** Signs out: clears the cookies and releases the session lock. */
export async function DELETE(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (session) {
    try {
      const decoded = await adminAuth().verifySessionCookie(decodeURIComponent(session));
      await getDb().from("user_session_locks").delete().eq("id", decoded.uid);
    } catch {
      // Already invalid: nothing to release.
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE, value: "", maxAge: 0, ...cookieBase });
  response.cookies.set({ name: SESSION_LOCK_COOKIE, value: "", maxAge: 0, ...cookieBase });
  return response;
}
