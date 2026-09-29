# Getting login working

Lobby's auth needs a Supabase project and two environment variables. **No
database schema, migrations or SQL are required** — every auth call goes
through `supabase.auth.*` and Supabase manages those tables itself. You can be
logged in without creating a single table.

Takes about five minutes.

---

## 1. Create the project

1. Sign in at <https://supabase.com/dashboard> with whichever account should
   own Lobby.
2. **New project**, then:
   - **Name** — `lobby` (cosmetic, change it freely)
   - **Database password** — generate one and save it in your password
     manager. You will not need it for login, but you cannot retrieve it later.
   - **Region** — pick the one nearest your users. `South Asia (Mumbai)`
     = `ap-south-1` if that's you.
3. Wait for provisioning — a couple of minutes.

> **Free plan allows 2 active projects per account.** If creation is refused,
> that account is at its cap: pause an existing project, or use an account with
> room.

---

## 2. Copy the two values

In the project: **Project Settings → API Keys**.

| Dashboard label | Goes into |
| --- | --- |
| Project URL — `https://<ref>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key — starts `sb_publishable_` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

**Never copy the secret key** (`sb_secret_…`, or the legacy `service_role`).
It bypasses row level security, and anything in a `NEXT_PUBLIC_` variable is
compiled into the browser bundle. The publishable key is safe to expose — it
grants nothing on its own.

---

## 3. Write them into `.env.local`

Replace the existing values. `.env.local` is gitignored.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 4. Allow the callback URL

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/**`

Signup confirmations and magic links both return to
`/auth/callback`. If that URL is not on the allow-list the email link bounces
and the user lands on the auth-error page.

---

## 5. Decide about email confirmation

**Authentication → Sign In / Providers → Email.**

By default Supabase requires a new account to confirm its address before it can
log in. If you leave it on and skip the email, your first login fails with
*"Confirm your email address first"* — this is the single most common reason
setup appears broken.

- **Fastest for local dev:** turn **Confirm email** *off*. You can sign up and
  log in immediately.
- **Keep it on** if you want to exercise the real flow — but note the built-in
  SMTP on the free plan is rate limited to a handful of messages per hour, and
  is not for production. Wire up your own SMTP before launch.

---

## 6. Restart and create your account

Next.js reads env at boot, so a restart is required:

```bash
npm run dev
```

Then go to <http://localhost:3000/signup> and create the first organizer
account. Organizers are the only people who ever sign up — captains register a
team from a shared link, and spectators need nothing.

---

## Troubleshooting

| What you see | What it means |
| --- | --- |
| *Could not reach the authentication server* | `NEXT_PUBLIC_SUPABASE_URL` is wrong, or the project is paused/deleted. Check the hostname resolves: `nslookup <ref>.supabase.co` |
| *Supabase is not configured yet* | One of the two variables is missing or empty. |
| *That email and password do not match* | Reached Supabase fine — the credentials are simply wrong, or no such account exists yet. Sign up first. |
| *Confirm your email address first* | See step 5. |
| Nothing changed after editing `.env.local` | The dev server was not restarted. |
| Port 3000 "in use", edits not appearing | An old `next dev` is still holding the port. Kill it and restart. |
