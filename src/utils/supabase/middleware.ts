import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_LOCK_COOKIE } from "@/lib/session-lock";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options })
        );
      },
    },
  });

  // Always use getUser() for fresh server-side auth (not getSession).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Role comes from profiles table (trigger-created), not user_metadata. Fetch to determine redirect.
  let role: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? user?.user_metadata?.role;
  }

  if (user && role === "admin" && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Security: public pages are allowed, but /dashboard and /admin require auth.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/join") ||
    path.startsWith("/login") ||
    path.startsWith("/contact") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/icon") ||
    path.startsWith("/og") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/manifest.json");

  const isProtectedRolePath =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/headmaster") ||
    path.startsWith("/tutor") ||
    path.startsWith("/student");

  if (!user && !isPublic && isProtectedRolePath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isProtectedRolePath) {
    const lockToken = request.cookies.get(SESSION_LOCK_COOKIE)?.value ?? null;
    if (!lockToken) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const { data: lockRow } = await supabase
      .from("user_session_locks")
      .select("lock_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!lockRow?.lock_token || lockRow.lock_token !== lockToken) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const mismatchResponse = NextResponse.redirect(url);
      mismatchResponse.cookies.set({
        name: SESSION_LOCK_COOKIE,
        value: "",
        path: "/",
        maxAge: 0,
      });
      return mismatchResponse;
    }
  }

  if (!user && request.cookies.get(SESSION_LOCK_COOKIE)?.value) {
    response.cookies.set({
      name: SESSION_LOCK_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

