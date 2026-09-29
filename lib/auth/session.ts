import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginPath } from "./redirect";

/**
 * The current organizer, or null.
 *
 * Uses `getUser()` rather than `getSession()` on purpose: `getSession()` reads
 * the cookie and trusts it, while `getUser()` revalidates the JWT with the
 * Supabase Auth server. Only the latter is safe to gate access on.
 *
 * Wrapped in `cache()` so a layout and the page it wraps share one round trip
 * per request instead of each paying for their own.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/**
 * Gate a Server Component on an authenticated organizer, preserving where the
 * visitor was heading.
 *
 * proxy.ts already redirects unauthenticated traffic away from `/dashboard`.
 * This is the second line: the proxy is a routing convenience, not a security
 * boundary, so every protected render re-checks.
 */
export async function requireUser(intendedPath: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(buildLoginPath(intendedPath));
  return user;
}

/**
 * Name to greet the organizer with.
 *
 * Reads `user_metadata.display_name`, which is what signup writes. Once the
 * `organizers` table lands this should read from there instead — metadata is
 * convenient but is not queryable or joinable.
 */
export function getDisplayName(user: User): string {
  const raw = user.user_metadata?.display_name;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();

  const emailLocalPart = user.email?.split("@")[0];
  return emailLocalPart && emailLocalPart.length > 0 ? emailLocalPart : "Organizer";
}
