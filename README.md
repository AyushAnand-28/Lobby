# Lobby

Tournament software for local and college sport. An organizer sets up a
tournament, registers teams, generates fixtures, enters scores from their phone
at the venue, and shares one public link that players and spectators can open.

**Status: early scaffolding.** This repository currently contains the landing
page and the organizer authentication surface. The database schema, tournament
management, fixtures, score entry and the public tournament page are not built
yet — see [What is not here yet](#what-is-not-here-yet).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, strict |
| Database & auth | Supabase (Postgres, Supabase Auth, row level security) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| Validation | Zod v4 |
| Tests | Vitest |
| Deploy target | Vercel |

There is no separate backend server, no state management library, and no auth
library other than Supabase Auth. That is deliberate.

## Local setup

Requires Node 20 or newer (developed on Node 24).

```bash
npm install
cp .env.example .env.local   # then fill it in — see below
npm run dev
```

The app runs at http://localhost:3000.

The landing page works with no configuration at all. The auth screens need
Supabase; without it they render and validate, then report that Supabase is not
configured rather than failing obscurely.

### Environment variables

Every variable is documented inline in [.env.example](.env.example). In short:

| Variable | Required | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project REST endpoint, `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…`. Safe in the browser; RLS is what protects data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | fallback | Legacy JWT key, for projects predating the new format |
| `NEXT_PUBLIC_SITE_URL` | for email links | Absolute origin used to build emailed auth links |

**Use the publishable key.** Supabase replaced the JWT-based `anon` /
`service_role` pair with independently rotatable `sb_publishable_…` /
`sb_secret_…` keys, and retires the legacy pair at the end of 2026. Privileges
are identical, so RLS behaves the same; only the format and rotation story
differ. The legacy variable is still read as a fallback.

Never put a secret key (`sb_secret_…` or the legacy `service_role`) in a
`NEXT_PUBLIC_*` variable. Those bypass row level security, and `NEXT_PUBLIC_*`
values are compiled into the client bundle.

Next.js reads env at boot — restart the dev server after editing `.env.local`.

### Supabase project setup

Dashboard links below use `_` in place of the project ref — Supabase resolves it
to whichever project you have selected.

1. Create a project at [supabase.com](https://supabase.com). Save the database
   password it makes you set; Drizzle migrations need it later and it is not
   shown again.
2. Copy the project URL and the publishable key into `.env.local`.
   → [Settings → API Keys](https://supabase.com/dashboard/project/_/settings/api-keys),
   **"Publishable and secret API keys"** tab.
3. → [Authentication → URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration)
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback`, and the
     production equivalent once deployed. Emailed links bounce if the redirect
     target is not on this list. This is the most common thing to get wrong.
4. → [Authentication → Providers](https://supabase.com/dashboard/project/_/auth/providers)
   - Expand **Email** and enable "Confirm email", so signup requires
     verification.
5. → [Authentication → Email Templates](https://supabase.com/dashboard/project/_/auth/templates)
   — optional but recommended. The default
   templates send a `{{ .ConfirmationURL }}` that round-trips through Supabase's
   own verify endpoint. Rewriting them to point straight at this app avoids that
   hop and works better with server-side rendering:

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
   ```

   Both shapes are handled — see [app/auth/callback/route.ts](app/auth/callback/route.ts).

   Note that Supabase's own docs write this snippet as `/auth/confirm`. This
   project handles `code` and `token_hash` in a single route at
   `/auth/callback`, and has no `/auth/confirm`. Copy the path above, not the
   one in their guide.

On the free tier Supabase's built-in SMTP is rate limited to a few emails per
hour, which is enough to test but not to demo. Configure your own SMTP under
**Project Settings → Auth** before showing it to anyone.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |

## How authentication works

Three audiences, deliberately different levels of access:

| Audience | Auth | Notes |
| --- | --- | --- |
| Organizer | Full account — email + password, or magic link | The only role that logs in |
| Team captain | Signed token link, no account | Submits a registration form. Not built yet |
| Spectator | None | Reads the public tournament page. Not built yet |

There is exactly one authenticated role. No roles table, no permissions system,
no admin tier.

Flows implemented so far:

- **Signup** — email + password with email verification, collecting the
  organizer's display name and optional phone into user metadata
- **Login** — email + password
- **Magic link** — emailed one-time link, for existing accounts only
- **Logout**
- **Session refresh** — [proxy.ts](proxy.ts) refreshes the Supabase session
  cookie on every server request
- **Protected routes** — `/dashboard` redirects anonymous visitors to
  `/login?next=…` and returns them to where they were headed

### Notes on the security-relevant bits

- **`getUser()`, never `getSession()`.** `getSession()` reads the cookie and
  trusts it. `getUser()` revalidates the JWT against the Supabase Auth server.
  Access is only ever gated on the latter.
- **The proxy is not the security boundary.** It is a routing convenience and
  can be bypassed. Every protected render re-checks via `requireUser()` in
  [lib/auth/session.ts](lib/auth/session.ts).
- **`?next=` is untrusted input.** `safeNextPath()` in
  [lib/auth/redirect.ts](lib/auth/redirect.ts) rejects absolute URLs,
  protocol-relative URLs, backslash variants, embedded control characters and
  auth routes, so it cannot be turned into an open redirect or a login loop.
  Covered by [tests/auth/redirect.test.ts](tests/auth/redirect.test.ts).
- **No account-existence oracle.** Signup and magic link return the same
  "check your inbox" message whether or not the address is registered.

## Project structure

```
app/
  (auth)/          login, signup — unauthenticated screens
  (dashboard)/     protected organizer routes
  auth/callback/   handles every emailed auth link
  page.tsx         landing page
lib/
  auth/            session helpers, route guards, server actions
  supabase/        SSR-aware Supabase clients
  validation/      Zod schemas
sports/
  registry.ts      sport -> { theme, components }, with generic fallbacks
  badminton/       theme.ts
components/
  ui/              shadcn
  auth/            form field, alert, submit button, logout
proxy.ts           session refresh + route protection
tests/
```

Two structural rules the code follows, and future code must too:

1. **Every sport-specific component needs a generic fallback**, resolved through
   `sports/registry.ts`. A new sport that supplies only a theme file must still
   render a complete, working — if plain — page.
2. **No hardcoded colors in sport-facing components.** Colors flow through the
   `--sport-accent` CSS variables. A theme sets them on a wrapper via
   `sportThemeVars()`; components use `bg-sport-accent`, `text-sport-accent` and
   friends.

### A note on file conventions

Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` — same runtime,
same matcher semantics. `middleware.ts` still works but logs a deprecation
warning, so this project uses the new name.

## What is not here yet

Deliberately out of scope for this slice:

- Database schema, Drizzle migrations, RLS policies
- Password reset (magic link covers the "I forgot my password" case for now)
- Tournament creation and management
- Team registration via captain token links
- Fixture generation, score entry, standings
- The public tournament page at `/t/[slug]`
- Payments, notifications, team accounts, admin panel, CI/CD

The next slice is the schema and RLS policies — `organizers`, `sports`,
`tournaments`, `participants` and `registration_tokens`, with row level security
enabled from the first migration and placeholder migrations reserving the
ordering for `stages`, `matches` and `results`.
