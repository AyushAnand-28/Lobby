/**
 * Post-login destination handling.
 *
 * The `?next=` parameter is attacker-controllable, so it is treated as
 * untrusted input everywhere it is read. Only same-origin, path-relative
 * destinations survive; anything else falls back to the dashboard.
 */

export const DEFAULT_REDIRECT = "/dashboard";
export const LOGIN_PATH = "/login";

/** Auth screens are never valid destinations — landing on them would loop. */
const AUTH_PATHS = ["/login", "/signup", "/auth"];

/** C0 controls plus DEL. Written as escapes so the source stays readable. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Narrow an untrusted `next` value to a safe same-origin path.
 *
 * Rejects:
 * - absolute URLs (`https://evil.com`) — would be an open redirect
 * - protocol-relative URLs (`//evil.com`) — same, browsers resolve the host
 * - backslash variants (`/\evil.com`) — several browsers normalise `\` to `/`
 *   before resolving, turning `/\evil.com` into `//evil.com`
 * - embedded control characters, used to smuggle past naive checks
 * - auth routes, which would bounce the user straight back to login
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_REDIRECT;

  const value = raw.trim();
  if (value.length === 0) return DEFAULT_REDIRECT;
  if (CONTROL_CHARS.test(value)) return DEFAULT_REDIRECT;

  // Must be path-relative.
  if (!value.startsWith("/")) return DEFAULT_REDIRECT;

  // `//host` and `/\host` both resolve to a foreign origin.
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_REDIRECT;

  const pathname = value.split(/[?#]/)[0] || "/";
  if (isAuthPath(pathname)) return DEFAULT_REDIRECT;

  return value;
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (authPath) => pathname === authPath || pathname.startsWith(`${authPath}/`),
  );
}

/**
 * Build the login URL for an unauthenticated visitor, preserving where they
 * were trying to go. `next` is omitted when it is just the default, to keep
 * the common URL clean.
 */
export function buildLoginPath(intendedPath: string): string {
  const next = safeNextPath(intendedPath);
  if (next === DEFAULT_REDIRECT) return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
