import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTournamentRow, type NewTournamentRow } from "@/lib/tournament/new-tournament";
import { tournamentSlug } from "@/lib/tournament/slug";
import { createTournamentSchema } from "@/lib/validation/tournament";
import { ANON, as, createTestDatabase, organizer, signUp } from "./harness";
import { activeToken } from "./seed";

/**
 * The organizer's create form, end to end below the UI: what the form posts,
 * through validation and `buildTournamentRow()`, inserted under RLS as the
 * organizer — then published and entered from the shared link.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

const FORM = {
  name: "City Open",
  format: "knockout",
  entryType: "singles",
  scoringPreset: "standard",
  thirdPlaceMatch: true,
  groupCount: "",
  advancePerGroup: "",
  maxParticipants: "",
  courtCount: "",
  venue: "",
  startsOn: "",
  endsOn: "",
  description: "",
};

function rowFrom(form: Partial<typeof FORM>): NewTournamentRow {
  return buildTournamentRow(createTournamentSchema.parse({ ...FORM, ...form }));
}

/** Insert as the organizer, as the Server Action does through PostgREST. */
async function insertAs(userId: string, row: NewTournamentRow): Promise<string> {
  const record: Record<string, unknown> = { ...row, slug: tournamentSlug(row.name) };
  const columns = Object.keys(record);
  const placeholders = columns.map((column, i) => (column === "settings" ? `$${i + 1}::jsonb` : `$${i + 1}`));
  const values = columns.map((column) =>
    column === "settings" ? JSON.stringify(record[column]) : record[column],
  );

  const result = await as(db, organizer(userId), () =>
    db.query<{ id: string }>(
      `insert into public.tournaments (${columns.join(", ")}) values (${placeholders.join(", ")}) returning id`,
      values,
    ),
  );
  return result.rows[0].id;
}

describe("creating a tournament from the form", () => {
  it.each([
    ["knockout", "singles"],
    ["round_robin", "doubles"],
    ["groups_knockout", "mixed"],
  ] as const)("inserts a %s %s tournament that satisfies every constraint", async (format, entryType) => {
    const userId = await signUp(db);
    const row = rowFrom({
      format,
      entryType,
      ...(format === "groups_knockout" ? { groupCount: "4", advancePerGroup: "2" } : {}),
      maxParticipants: "32",
      venue: "Town Hall",
      startsOn: "2026-10-12",
      endsOn: "2026-10-13",
    });

    const id = await insertAs(userId, row);
    const stored = await db.query<{
      status: string;
      roster_min: number;
      roster_max: number;
      third_place_match: boolean;
      organizer_id: string;
    }>("select status, roster_min, roster_max, third_place_match, organizer_id from public.tournaments where id = $1", [id]);

    expect(stored.rows[0]).toMatchObject({
      status: "draft",
      organizer_id: userId,
      roster_min: entryType === "singles" ? 1 : 2,
      roster_max: entryType === "singles" ? 1 : 2,
      // Asked for, but a round robin has no bracket to play it in.
      third_place_match: format !== "round_robin",
    });
    // Every tournament is born with its shared link.
    expect(await activeToken(db, id)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("takes entries from the shared link once published", async () => {
    const userId = await signUp(db);
    const id = await insertAs(userId, rowFrom({ entryType: "doubles" }));
    const token = await activeToken(db, id);

    const before = await as(db, ANON, () =>
      db.query<{ p: { reason: string } }>("select public.registration_preview($1) as p", [token]),
    );
    expect(before.rows[0].p.reason).toBe("not_published");

    // What publishTournamentAction does.
    await as(db, organizer(userId), () =>
      db.query("update public.tournaments set status = 'registration' where id = $1 and status = 'draft'", [id]),
    );

    const after = await as(db, ANON, () =>
      db.query<{ p: { accepting: boolean; tournament: { roster_min: number } } }>(
        "select public.registration_preview($1) as p",
        [token],
      ),
    );
    expect(after.rows[0].p.accepting).toBe(true);
    expect(after.rows[0].p.tournament.roster_min).toBe(2);

    const entry = await as(db, ANON, () =>
      db.query<{ id: string }>(
        "select public.submit_registration($1, $2, $3, $4, $5, $6, $7) as id",
        [token, "Rao / Menon", ["Asha Rao", "Kiran Menon"], "Asha Rao", "98450 12345", null, null],
      ),
    );
    expect(entry.rows[0].id).toBeTruthy();
  });

  it("lets another organizer read a published tournament, which is why the dashboard filters by owner", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const id = await insertAs(owner, rowFrom({}));
    await as(db, organizer(owner), () =>
      db.query("update public.tournaments set status = 'registration' where id = $1", [id]),
    );

    const seen = await as(db, organizer(other), () =>
      db.query("select id from public.tournaments where id = $1", [id]),
    );
    expect(seen.rows).toHaveLength(1);

    // ...but cannot change it: RLS matches no rows.
    const updated = await as(db, organizer(other), () =>
      db.query("update public.tournaments set registration_open = false where id = $1", [id]),
    );
    expect(updated.affectedRows).toBe(0);
  });
});
