import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/**
 * Clears a session that can no longer be honoured, then sends the visitor to
 * sign in again.
 *
 * This exists because a cookie cannot be deleted while a page renders - Next
 * allows cookie writes only in a Server Action or a Route Handler. So a guard
 * that discovers a dead session mid-render has nowhere to put the fix, and the
 * previous code just redirected to /login. That produced an infinite loop:
 * /login saw a structurally valid session and bounced to the dashboard, the
 * dashboard could not find the user and bounced back, forever. A browser stuck
 * in that loop looks like a page that never loads.
 *
 * Redirecting here breaks the cycle by actually removing the cookie, so the
 * next request is genuinely signed out and /login renders normally.
 *
 * The usual way to arrive is a database that was rebuilt underneath a live
 * browser session: the JWT still verifies, because the signing secret has not
 * changed, but the user id inside it no longer exists.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await destroySession();

  const target = new URL("/login", request.url);
  const response = NextResponse.redirect(target);
  // Belt and braces: the redirect itself must never be cached, or a stale
  // session could be "cleared" from cache without the cookie being touched.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
