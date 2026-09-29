import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Single landing point for every emailed auth link: signup confirmation and
 * magic link both come through here.
 *
 * Supabase can deliver the credential in two shapes depending on how the email
 * templates are written, so both are handled:
 *
 * - `?code=...`       default templates. PKCE code, exchanged for a session.
 *                     The verifier cookie was set when the action was called.
 * - `?token_hash=...&type=...`  templates rewritten to use `{{ .TokenHash }}`.
 *                     Verified directly, no round trip through Supabase's
 *                     `/auth/v1/verify` redirector.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  // Supabase reports link failures (expired, already used) as query params.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(errorUrl(origin, providerError));
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(errorUrl(origin, "Supabase is not configured."));
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(errorUrl(origin, error.message));
    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return NextResponse.redirect(errorUrl(origin, error.message));
    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(errorUrl(origin, "That link is missing its verification code."));
}

function errorUrl(origin: string, reason: string): URL {
  const url = new URL("/auth/auth-error", origin);
  url.searchParams.set("reason", reason);
  return url;
}
