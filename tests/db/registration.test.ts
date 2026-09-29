import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { registrationBlockReason } from "@/lib/tournament/registration";
import type { TournamentStatus } from "@/lib/tournament/types";
import { ANON, as, createTestDatabase, errorOf, organizer, signUp } from "./harness";
import { activeToken, createTournament } from "./seed";

/**
 * The shared registration link: one reusable token per tournament, used
 * anonymously by any captain it reaches.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

type Preview = {
  accepting: boolean;
  reason: string;
  live_entries: number;
  tournament: { name: string; roster_min: number } | null;
} | null;

async function preview(token: string): Promise<Preview> {
  const result = await as(db, ANON, () =>
    db.query<{ preview: Preview }>("select public.registration_preview($1) as preview", [token]),
  );
  return result.rows[0].preview;
}

async function submit(
  token: string,
  entry: { name: string; players?: string[]; captain?: string; phone?: string | null },
): Promise<string> {
  const result = await as(db, ANON, () =>
    db.query<{ id: string }>(
      "select public.submit_registration($1, $2, $3, $4, $5, $6, $7, $8) as id",
      [
        token,
        entry.name,
        entry.players ?? [entry.name],
        entry.captain ?? "Captain",
        entry.phone === undefined ? "+91 90000 00000" : entry.phone,
        "captain@example.com",
        "City Club",
        null,
      ],
    ),
  );
  return result.rows[0].id;
}

describe("registration_preview", () => {
  it("returns null for an unknown token", async () => {
    expect(await preview("not-a-real-token-at-all-000")).toBeNull();
  });

  it("confirms a draft's link exists but reveals nothing about it", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { status: "draft" });
    expect(await preview(await activeToken(db, id))).toEqual({
      accepting: false,
      reason: "not_published",
      live_entries: 0,
      tournament: null,
    });
  });

  it("describes an open tournament", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { rosterMin: 2, rosterMax: 2 });
    const result = await preview(await activeToken(db, id));
    expect(result).toMatchObject({ accepting: true, reason: "open", live_entries: 0 });
    expect(result?.tournament).toMatchObject({ name: "Test Open", roster_min: 2 });
  });
});

describe("submit_registration", () => {
  it("files a pending entry with private contact details", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const entryId = await submit(await activeToken(db, id), { name: "  Arjun Mehta  " });

    const row = await as(db, organizer(owner), () =>
      db.query<{ name: string; status: string; source: string; club: string; phone: string }>(
        `select p.name, p.status, p.source, p.club, c.phone
         from public.participants p join public.participant_contacts c on c.participant_id = p.id
         where p.id = $1`,
        [entryId],
      ),
    );
    expect(row.rows[0]).toEqual({
      name: "Arjun Mehta",
      status: "pending",
      source: "registration",
      club: "City Club",
      phone: "+91 90000 00000",
    });

    // The captain cannot read back what they submitted — pending is private.
    const visible = await as(db, ANON, () =>
      db.query("select id from public.participants where id = $1", [entryId]),
    );
    expect(visible.rows).toHaveLength(0);
  });

  it("rejects an unknown or revoked token", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const oldToken = await activeToken(db, id);

    const fresh = await as(db, organizer(owner), () =>
      db.query<{ token: string }>("select public.rotate_registration_token($1) as token", [id]),
    );

    expect(await errorOf(submit(oldToken, { name: "Late" }))).toContain("invalid_token");
    expect(await preview(oldToken)).toBeNull();
    await expect(submit(fresh.rows[0].token, { name: "On time" })).resolves.toBeTypeOf("string");
  });

  it("refuses entries while the tournament is a draft", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { status: "draft" });
    expect(await errorOf(submit(await activeToken(db, id), { name: "Early" }))).toContain(
      "registration_not_published",
    );
  });

  it("refuses entries once registration is closed or past its deadline", async () => {
    const owner = await signUp(db);
    const closed = await createTournament(db, owner);
    const late = await createTournament(db, owner);
    await as(db, organizer(owner), async () => {
      await db.query("update public.tournaments set registration_open = false where id = $1", [closed]);
      await db.query(
        "update public.tournaments set registration_closes_at = now() - interval '1 minute' where id = $1",
        [late],
      );
    });

    expect(await errorOf(submit(await activeToken(db, closed), { name: "A" }))).toContain("registration_closed");
    expect(await errorOf(submit(await activeToken(db, late), { name: "B" }))).toContain(
      "registration_deadline_passed",
    );
  });

  it("stops at the maximum, counting pending entries", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { maxParticipants: 2 });
    const token = await activeToken(db, id);

    await submit(token, { name: "First" });
    await submit(token, { name: "Second" });
    expect(await errorOf(submit(token, { name: "Third" }))).toContain("registration_full");
    expect(await preview(token)).toMatchObject({ accepting: false, reason: "full", live_entries: 2 });
  });

  it("reopens a slot when an entry is rejected", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { maxParticipants: 2 });
    const token = await activeToken(db, id);
    const first = await submit(token, { name: "First" });
    await submit(token, { name: "Second" });

    await as(db, organizer(owner), () =>
      db.query("update public.participants set status = 'rejected' where id = $1", [first]),
    );
    await expect(submit(token, { name: "Third" })).resolves.toBeTypeOf("string");
  });

  it("refuses a duplicate name, ignoring case", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const token = await activeToken(db, id);
    await submit(token, { name: "Smash Bros" });
    expect(await errorOf(submit(token, { name: "smash bros" }))).toContain("duplicate_name");
  });

  it("enforces the roster size the tournament asks for", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner, { rosterMin: 2, rosterMax: 2 });
    const token = await activeToken(db, id);

    expect(await errorOf(submit(token, { name: "Solo", players: ["Only One"] }))).toContain("invalid_players");
    expect(
      await errorOf(submit(token, { name: "Crowd", players: ["One", "Two", "Three"] })),
    ).toContain("invalid_players");
    // Blank names do not count towards the roster.
    expect(await errorOf(submit(token, { name: "Blank", players: ["One", "  "] }))).toContain(
      "invalid_players",
    );
    await expect(submit(token, { name: "Pair", players: ["One", "Two"] })).resolves.toBeTypeOf("string");
  });

  it("requires a captain and a phone number", async () => {
    const owner = await signUp(db);
    const id = await createTournament(db, owner);
    const token = await activeToken(db, id);
    expect(await errorOf(submit(token, { name: "No Phone", phone: "  " }))).toContain("invalid_phone");
    expect(await errorOf(submit(token, { name: "No Captain", captain: "" }))).toContain("invalid_captain");
  });
});

describe("registration state mirror", () => {
  /**
   * lib/tournament/registration.ts re-implements the database's reason logic
   * for the organizer's UI. Run both over the same states.
   */
  it.each([
    ["draft", true, null, null, 0],
    ["registration", true, null, null, 0],
    ["registration", false, null, null, 0],
    ["registration", true, "past", null, 0],
    ["registration", true, "future", 4, 3],
    ["registration", true, null, 4, 4],
  ] as const)(
    "agrees for status=%s open=%s deadline=%s max=%s entries=%i",
    async (status, open, deadline, max, entries) => {
      const closesAt =
        deadline === null
          ? null
          : new Date(Date.now() + (deadline === "past" ? -60_000 : 3_600_000)).toISOString();

      const sql = await db.query<{ reason: string | null }>(
        `select private.registration_block_reason(
           jsonb_populate_record(null::public.tournaments, $1::jsonb), $2::int) as reason`,
        [
          JSON.stringify({
            status,
            registration_open: open,
            registration_closes_at: closesAt,
            max_participants: max,
          }),
          entries,
        ],
      );

      const ts = registrationBlockReason(
        {
          status: status as TournamentStatus,
          registration_open: open,
          registration_closes_at: closesAt,
          max_participants: max,
        },
        entries,
      );
      expect(ts).toBe(sql.rows[0].reason);
    },
  );
});
