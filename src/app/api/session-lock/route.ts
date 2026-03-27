import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SESSION_LOCK_COOKIE } from "@/lib/session-lock";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const lockToken = randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_session_locks").upsert(
    {
      user_id: user.id,
      lock_token: lockToken,
      last_seen: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_LOCK_COOKIE,
    value: lockToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
