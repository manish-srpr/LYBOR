import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCATION_COOKIE, LOCATION_GRANTED } from "@/lib/location-session";

/**
 * Sends a worker or employer to the location step before their dashboard is
 * rendered at all.
 *
 * This exists because a redirect from inside a layout is not early enough.
 * React renders the layout and the page concurrently, so by the time the
 * layout's redirect throws, the page has already been computed and its
 * content is in the 307 response body - a browser never shows it, but curl
 * does. Proxy runs before routes are rendered, so here the dashboard is never
 * built in the first place.
 *
 * Deliberately narrow. It checks one cookie and nothing else:
 *
 *  - Authorization stays in the role layouts, with requireRole. Duplicating it
 *    here would create a second authorization path to keep in step with the
 *    first, which is how those things drift apart.
 *  - It cannot reach the database or verify the JWT, and does not try. An
 *    unauthenticated request that slips past this lands on the layout's
 *    requireRole, which redirects it to sign in.
 *
 * And it is still not a security boundary: the cookie is written by the client
 * once the browser grants permission, so a determined person can set it by
 * hand. What they gain is a dashboard they are already authenticated for.
 * Every attendance decision is made server-side in attendance-core.ts from
 * coordinates measured against the job site, and none of that is affected.
 */
export function proxy(request: NextRequest) {
  const granted = request.cookies.get(LOCATION_COOKIE)?.value === LOCATION_GRANTED;
  if (granted) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const target = new URL("/location", request.url);
  target.searchParams.set("next", pathname + search);

  const response = NextResponse.redirect(target);
  // A cached redirect would strand somebody on the step after they grant.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export const config = {
  // Worker and employer areas only. Admin never punches attendance and is
  // deliberately excluded, as are the public pages, the location step itself
  // and the session-clearing route - gating any of those would be a loop.
  matcher: ["/worker/:path*", "/employer/:path*"],
};
