import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { buildLoginPath, DEFAULT_REDIRECT, safeNextPath } from "@/lib/auth/redirect";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`. Same
 * runtime, same matcher semantics; the old filename still works but warns.
 *
 * Two jobs here:
 * 1. Refresh the Supabase session cookie on every server request, so a tab
 *    left open overnight is still logged in.
 * 2. Bounce unauthenticated traffic away from protected routes, remembering
 *    where it was headed.
 *
 * Job 2 is a convenience, not the security boundary — see requireUser().
 */

const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const env = readSupabaseEnv();

  // No Supabase config yet: let everything through so the landing page still
  // renders on a fresh clone. The protected routes re-check server-side and
  // will redirect to login regardless.
  if (!env) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // @supabase/ssr 0.12 passes no-store headers alongside auth cookies.
        // Dropping them risks a CDN caching one organizer's session for another.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must be getUser(), not getSession(): this call is what actually refreshes
  // an expiring access token, and it validates the JWT rather than trusting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    return redirectPreservingCookies(
      request,
      response,
      buildLoginPath(`${pathname}${search}`),
    );
  }

  // A logged-in organizer has no business on the login or signup screen.
  if (user && AUTH_PAGES.includes(pathname)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return redirectPreservingCookies(request, response, next || DEFAULT_REDIRECT);
  }

  return response;
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Redirecting mid-refresh would otherwise discard the rotated session cookies
 * and log the user out on the very request that renewed them.
 */
function redirectPreservingCookies(
  request: NextRequest,
  carrier: NextResponse,
  destination: string,
): NextResponse {
  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of carrier.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Auth cookies must be
     * refreshed on page and route-handler requests, but running this on every
     * image would just add latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
