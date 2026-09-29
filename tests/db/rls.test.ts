import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { ANON, as, createTestDatabase, errorOf, organizer, signUp } from "./harness";
import { addApprovedEntries, createTournament } from "./seed";

/**
 * Row level security, asserted against the real migrations.
 *
 * Each test builds its own organizers and tournaments, so they share one
 * database without depending on each other's rows.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

describe("organizer profiles", () => {
  it("are created from signup metadata", async () => {
    const id = await signUp(db, "Asha Rao", "+91 98765 43210");
    const profile = await as(db, organizer(id), () =>
      db.query<{ display_name: string; phone: string }>("select display_name, phone from public.organizers"),
    );
    expect(profile.rows).toEqual([{ display_name: "Asha Rao", phone: "+91 98765 43210" }]);
  });

  it("are invisible to other organizers and to anon", async () => {
    await signUp(db, "Someone Else");
    const mine = await signUp(db, "Me");
    const seen = await as(db, organizer(mine), () => db.query("select id from public.organizers"));
    expect(seen.rows).toHaveLength(1);
    expect(await errorOf(as(db, ANON, () => db.query("select id from public.organizers")))).toMatch(
      /permission denied/,
    );
  });
});

describe("tournaments", () => {
  it("keeps drafts private to their organizer", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const draft = await createTournament(db, owner, { status: "draft" });

    const count = (rows: { rows: unknown[] }) => rows.rows.length;
    const query = () => db.query("select id from public.tournaments where id = $1", [draft]);

    expect(count(await as(db, organizer(owner), query))).toBe(1);
    expect(count(await as(db, organizer(other), query))).toBe(0);
    expect(count(await as(db, ANON, query))).toBe(0);
  });

  it("shows published tournaments to everyone", async () => {
    const owner = await signUp(db);
    const published = await createTournament(db, owner);
    const seen = await as(db, ANON, () =>
      db.query("select id from public.tournaments where id = $1", [published]),
    );
    expect(seen.rows).toHaveLength(1);
  });

  it("lets nobody but the owner change or delete one", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const id = await createTournament(db, owner);

    const updated = await as(db, organizer(other), () =>
      db.query("update public.tournaments set name = 'Hijacked' where id = $1", [id]),
    );
    expect(updated.affectedRows).toBe(0);

    const deleted = await as(db, organizer(other), () =>
      db.query("delete from public.tournaments where id = $1", [id]),
    );
    expect(deleted.affectedRows).toBe(0);

    expect(
      await errorOf(as(db, ANON, () => db.query("update public.tournaments set name = 'x' where id = $1", [id]))),
    ).toMatch(/permission denied/);
  });

  it("refuses a tournament created on someone else's behalf", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const error = await errorOf(
      as(db, organizer(other), () =>
        db.query(
          `insert into public.tournaments (organizer_id, sport, slug, name, format)
           values ($1, 'badminton', $2, 'Spoofed', 'knockout')`,
          [owner, `spoof-${crypto.randomUUID().slice(0, 6)}`],
        ),
      ),
    );
    expect(error).toMatch(/row-level security/);
  });

  it("gives every tournament a registration link, readable only by its owner", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const id = await createTournament(db, owner);
    const query = () => db.query("select token from public.registration_tokens where tournament_id = $1", [id]);

    expect((await as(db, organizer(owner), query)).rows).toHaveLength(1);
    expect((await as(db, organizer(other), query)).rows).toHaveLength(0);
    expect(await errorOf(as(db, ANON, query))).toMatch(/permission denied/);
  });
});

describe("entries", () => {
  it("shows spectators approved entries only, and never contact details", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const [approved] = await addApprovedEntries(db, owner, id, 1);

    await as(db, organizer(owner), async () => {
      const pending = await db.query<{ id: string }>(
        "insert into public.participants (tournament_id, name, status) values ($1, 'Pending Pair', 'pending') returning id",
        [id],
      );
      await db.query(
        "insert into public.participant_contacts (participant_id, tournament_id, captain_name, phone) values ($1, $2, 'Cap', '999')",
        [pending.rows[0].id, id],
      );
    });

    const visible = await as(db, ANON, () =>
      db.query<{ id: string }>("select id from public.participants where tournament_id = $1", [id]),
    );
    expect(visible.rows.map((row) => row.id)).toEqual([approved]);

    expect(
      await errorOf(as(db, ANON, () => db.query("select * from public.participant_contacts"))),
    ).toMatch(/permission denied/);

    const contacts = await as(db, organizer(owner), () =>
      db.query("select captain_name from public.participant_contacts where tournament_id = $1", [id]),
    );
    expect(contacts.rows).toEqual([{ captain_name: "Cap" }]);
  });

  it("stops anon writing entries directly — registration goes through the function", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const error = await errorOf(
      as(db, ANON, () =>
        db.query("insert into public.participants (tournament_id, name) values ($1, 'Sneaky')", [id]),
      ),
    );
    expect(error).toMatch(/permission denied/);
  });

  it("stops one organizer adding entries to another's tournament", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const id = await createTournament(db, owner);
    const error = await errorOf(
      as(db, organizer(other), () =>
        db.query("insert into public.participants (tournament_id, name) values ($1, 'Intruder')", [id]),
      ),
    );
    expect(error).toMatch(/row-level security/);
  });

  it("hides every entry of a draft tournament from anon", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { status: "draft" });
    await addApprovedEntries(db, owner, id, 2);
    const visible = await as(db, ANON, () =>
      db.query("select id from public.participants where tournament_id = $1", [id]),
    );
    expect(visible.rows).toHaveLength(0);
  });
});

describe("tournament guard", () => {
  it("refuses a status jump into play outside the fixture functions", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const error = await errorOf(
      as(db, organizer(owner), () =>
        db.query("update public.tournaments set status = 'in_progress' where id = $1", [id]),
      ),
    );
    expect(error).toContain("status_managed_by_fixtures");
  });

  it("stamps published_at on first publish", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const row = await db.query<{ published_at: string | null }>(
      "select published_at from public.tournaments where id = $1",
      [id],
    );
    expect(row.rows[0].published_at).not.toBeNull();
  });

  it("keeps organizer-only functions away from anon", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const error = await errorOf(
      as(db, ANON, () => db.query("select public.reset_fixtures($1, 'all')", [id])),
    );
    expect(error).toMatch(/permission denied/);
  });
});
