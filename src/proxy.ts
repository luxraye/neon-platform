import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-lock";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/headmaster", "/tutor", "/student"];

/**
 * Fast first gate: send visitors without a session cookie to /login.
 * The full check (valid cookie, session lock, role, centre) happens on the server in
 * `requireRole` / `getActor`, so a forged cookie gets no further than this redirect.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (isProtected && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/headmaster/:path*", "/tutor/:path*", "/student/:path*"],
};
