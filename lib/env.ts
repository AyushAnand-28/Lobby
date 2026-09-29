/**
 * Supabase environment access.
 *
 * These are read through literal `process.env.X` member access on purpose:
 * Next.js only inlines `NEXT_PUBLIC_*` variables into the client bundle when
 * they are referenced literally. Dynamic access (`process.env[key]`) silently
 * yields `undefined` in the browser.
 *
 * Nothing here throws at module scope. A missing Supabase config degrades the
 * auth surface with a clear message instead of taking down the landing page.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Prefer the publishable key (sb_publishable_...). The legacy anon key is a
  // JWT derived from the project's JWT secret; Supabase retires that format at
  // the end of 2026, so it is only a fallback for older projects. Both carry
  // identical privileges, so RLS behaves the same either way.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env;
}

/**
 * Absolute origin used to build email redirect links (verification, magic
 * link, password reset). Supabase sends these by email, so a request-relative
 * URL is not enough — it has to be absolute and it has to match an entry in
 * the project's redirect allow-list.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  // Set automatically on Vercel deployments (preview and production).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
