import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

/**
 * An in-process Postgres with just enough of Supabase around it to run the
 * real migrations and exercise row level security.
 *
 * PGlite is Postgres compiled to WebAssembly — no Docker, no network, no
 * Supabase project. It enforces RLS, roles and grants exactly as a server
 * does, which is the whole point: these tests assert what an anonymous
 * visitor or another organizer can actually read and write.
 *
 * What is emulated, mirroring a fresh Supabase project:
 * - the `anon`, `authenticated` and `service_role` roles
 * - `auth.users` and `auth.uid()`, which reads the JWT `sub` claim that
 *   PostgREST sets per request
 * - Supabase's default privileges: full table DML and function EXECUTE for
 *   anon and authenticated, leaving RLS as the only barrier
 */
const SUPABASE_BOOTSTRAP = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  create function auth.uid() returns uuid
  language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(MIGRATIONS_DIR, file));
}

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`Migration ${path.basename(file)} failed: ${String(error)}`);
    }
  }
  return db;
}

export type Caller = { role: "anon" } | { role: "authenticated"; userId: string };

export const ANON: Caller = { role: "anon" };

export function organizer(userId: string): Caller {
  return { role: "authenticated", userId };
}

/**
 * Run `fn` as a Data API caller would: under the anon or authenticated role,
 * with `auth.uid()` resolving to the given user. Always drops back to the
 * superuser afterwards, even when `fn` throws.
 */
export async function as<T>(db: PGlite, caller: Caller, fn: () => Promise<T>): Promise<T> {
  const sub = caller.role === "authenticated" ? caller.userId : "";
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  await db.exec(`set role ${caller.role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Sign up an organizer, as Supabase Auth would. Returns the user id. */
export async function signUp(
  db: PGlite,
  displayName = "Test Organizer",
  phone: string | null = null,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [
      `${crypto.randomUUID()}@example.com`,
      JSON.stringify({ display_name: displayName, phone }),
    ],
  );
  return result.rows[0].id;
}

/** Postgres error message, for asserting on the codes the functions raise. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the query to fail, but it succeeded.");
}
