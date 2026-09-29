import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

/**
 * Supabase client for Client Components.
 *
 * V1 does all auth through Server Actions, so this exists for future
 * client-side reads (live standings, optimistic score entry) rather than for
 * the auth forms.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
