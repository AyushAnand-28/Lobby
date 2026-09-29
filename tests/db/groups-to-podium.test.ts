import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { planKnockoutFromGroups } from "@/lib/tournament/groups";
import { orderForDraw, planFixtures, qualifiersFromStandings } from "@/lib/tournament/plan";
import { buildTournamentView, type EntryRow, type MatchRow } from "@/lib/tournament/view";
import { as, createTestDatabase, errorOf, organizer, signUp } from "./harness";
import { addApprovedEntries, createTournament, statusOf } from "./seed";

/**
 * A groups-then-knockout tournament from draw to podium, with the app's own
 * planner and view in the loop exactly as the draw actions use them.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

const SHAPE = {
  sport: "badminton",
  settings: { entryType: "singles", scoringPreset: "standard" },
  format: "groups_knockout" as const,
  status: "in_progress" as const,
  advance_per_group: 2,
  court_count: null,
};

async function load(tournamentId: string) {
  const entries = await db.query<EntryRow>(
    "select id, name, players, club, seed, group_label, status from public.participants where tournament_id = $1",
    [tournamentId],
  );
  const matches = await db.query<MatchRow>(
    "select * from public.matches where tournament_id = $1",
    [tournamentId],
  );
  return buildTournamentView(SHAPE, entries.rows, matches.rows);
}

async function record(userId: string, match: MatchRow, winner: "a" | "b") {
  const games = winner === "a" ? [{ a: 21, b: 12 }, { a: 21, b: 15 }] : [{ a: 12, b: 21 }, { a: 15, b: 21 }];
  await as(db, organizer(userId), () =>
    db.query("select public.record_match_result($1, 'completed', $2::jsonb, $3)", [
      match.id,
      JSON.stringify(games),
      winner === "a" ? match.participant_a_id : match.participant_b_id,
    ]),
  );
}

describe("groups, then knockout, to the podium", () => {
  it("plays out end to end", async () => {
    const userId = await signUp(db);
    const tournamentId = await createTournament(db, userId, {
      format: "groups_knockout",
      groupCount: 2,
      advancePerGroup: 2,
      thirdPlace: true,
    });
    const ids = await addApprovedEntries(db, userId, tournamentId, 8);
    // "Player 1" is the strongest: the lower number wins every match below.
    const strength = new Map(ids.map((id, index) => [id, index]));

    const plan = planFixtures({
      format: "groups_knockout",
      seeded: orderForDraw(
        ids.map((id) => ({ id, seed: null })),
        { shuffle: false },
      ),
      thirdPlace: true,
      groupCount: 2,
      advancePerGroup: 2,
    });
    await as(db, organizer(userId), () =>
      db.query("select public.generate_fixtures($1, $2::jsonb, $3::jsonb)", [
        tournamentId,
        JSON.stringify(plan.matches),
        JSON.stringify(plan.groups),
      ]),
    );

    let view = await load(tournamentId);
    expect(view.groups.map((group) => group.rows.length)).toEqual([4, 4]);

    // The knockout can't be drawn until the groups are done.
    const early = planKnockoutFromGroups(
      qualifiersFromStandings(new Map(view.groups.map((g) => [g.label!, g.rows])), 2),
      { thirdPlace: true, startNumber: 100 },
    );
    expect(
      await errorOf(
        as(db, organizer(userId), () =>
          db.query("select public.add_knockout_stage($1, $2::jsonb)", [tournamentId, JSON.stringify(early)]),
        ),
      ),
    ).toBe("groups_incomplete");

    for (const match of view.matches) {
      const a = strength.get(match.participant_a_id!)!;
      const b = strength.get(match.participant_b_id!)!;
      await record(userId, match, a < b ? "a" : "b");
    }

    view = await load(tournamentId);
    expect(view.needsKnockoutDraw).toBe(true);
    expect(await statusOf(db, tournamentId)).toBe("in_progress");

    // What drawKnockoutAction does.
    const lastNumber = view.matches.reduce((max, m) => Math.max(max, m.number ?? 0), 0);
    const knockout = planKnockoutFromGroups(
      qualifiersFromStandings(new Map(view.groups.map((g) => [g.label!, g.rows])), 2),
      { thirdPlace: true, startNumber: lastNumber + 1 },
    );
    await as(db, organizer(userId), () =>
      db.query("select public.add_knockout_stage($1, $2::jsonb)", [tournamentId, JSON.stringify(knockout)]),
    );

    view = await load(tournamentId);
    expect(view.knockout.map((round) => round.length)).toEqual([2, 1]);
    // Semi-finals pair a group winner with the other group's runner-up.
    for (const semi of view.knockout[0]) {
      const groups = [semi.participant_a_id, semi.participant_b_id].map(
        (id) => view.entries.get(id!)!.group_label,
      );
      expect(new Set(groups).size).toBe(2);
    }
    // Group results are locked now.
    const groupMatch = view.matches.find((m) => m.stage === "group")!;
    expect(await errorOf(record(userId, groupMatch, "b"))).toBe("group_stage_locked");

    for (const semi of view.knockout[0]) {
      const a = strength.get(semi.participant_a_id!)!;
      const b = strength.get(semi.participant_b_id!)!;
      await record(userId, semi, a < b ? "a" : "b");
    }
    view = await load(tournamentId);
    await record(userId, view.knockout[1][0], "a");
    await record(userId, view.thirdPlace!, "b");

    view = await load(tournamentId);
    expect(await statusOf(db, tournamentId)).toBe("completed");
    expect(view.podium).toEqual({
      champion: view.knockout[1][0].participant_a_id,
      runnerUp: view.knockout[1][0].participant_b_id,
      third: view.thirdPlace!.participant_b_id,
    });
    expect(view.entries.get(view.podium!.champion!)!.name).toBe("Player 1");
  });
});
