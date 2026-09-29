import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { planFixtures } from "@/lib/tournament/plan";
import { ANON, as, createTestDatabase, errorOf, organizer, signUp } from "./harness";
import { addApprovedEntries, createTournament, matchesOf, statusOf, type MatchRow } from "./seed";

/**
 * Playing a tournament through the database functions: the draw, courts,
 * results from the organizer and from the scorer link, and completion.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

type Game = { a: number; b: number };

async function drawKnockout(userId: string, entries: number) {
  const tournamentId = await createTournament(db, userId, { format: "knockout", thirdPlace: true });
  const ids = await addApprovedEntries(db, userId, tournamentId, entries);
  const plan = planFixtures({
    format: "knockout",
    seeded: ids,
    thirdPlace: true,
    groupCount: null,
    advancePerGroup: null,
  });
  await as(db, organizer(userId), () =>
    db.query("select public.generate_fixtures($1, $2::jsonb, $3::jsonb)", [
      tournamentId,
      JSON.stringify(plan.matches),
      JSON.stringify(plan.groups),
    ]),
  );
  return { tournamentId, ids };
}

async function scorerToken(tournamentId: string): Promise<string> {
  const result = await db.query<{ token: string }>(
    "select token from public.scorer_tokens where tournament_id = $1 and revoked_at is null",
    [tournamentId],
  );
  return result.rows[0].token;
}

function byRound(matches: MatchRow[], stage: string, round: number): MatchRow[] {
  return matches
    .filter((match) => match.stage === stage && match.round === round)
    .sort((x, y) => x.position - y.position);
}

async function record(
  userId: string,
  matchId: string,
  status: string,
  games: Game[],
  winnerId: string | null,
) {
  return as(db, organizer(userId), () =>
    // Four arguments: callers from before the live column still resolve.
    db.query("select public.record_match_result($1, $2, $3::jsonb, $4)", [
      matchId,
      status,
      JSON.stringify(games),
      winnerId,
    ]),
  );
}

async function scorerRecord(
  token: string,
  matchId: string,
  status: string,
  games: Game[],
  winnerId: string | null,
  live: object | null = null,
) {
  return as(db, ANON, () =>
    db.query("select public.scorer_record_result($1, $2, $3, $4::jsonb, $5, $6::jsonb)", [
      token,
      matchId,
      status,
      JSON.stringify(games),
      winnerId,
      live === null ? null : JSON.stringify(live),
    ]),
  );
}

async function courtAs(userId: string, matchId: string, court: string | null) {
  return as(db, organizer(userId), () =>
    db.query("select public.assign_court($1, $2)", [matchId, court]),
  );
}

describe("a knockout played to the end", () => {
  it("runs from draw to podium, through the organizer and the scorer link", async () => {
    const userId = await signUp(db);
    const { tournamentId } = await drawKnockout(userId, 4);

    expect(await statusOf(db, tournamentId)).toBe("in_progress");
    const semis = byRound(await matchesOf(db, tournamentId), "knockout", 1);
    expect(semis).toHaveLength(2);

    // Courts need a court count first.
    expect(await errorOf(courtAs(userId, semis[0].id, "1"))).toBe("courts_not_set");
    await as(db, organizer(userId), () =>
      db.query("update public.tournaments set court_count = 2 where id = $1", [tournamentId]),
    );
    await courtAs(userId, semis[0].id, "1");
    expect(await errorOf(courtAs(userId, semis[1].id, "1"))).toBe("court_busy");
    expect(await errorOf(courtAs(userId, semis[1].id, "3"))).toBe("invalid_court");
    await courtAs(userId, semis[1].id, "2");

    // Semi 1 from the scorer link, scored live and then confirmed.
    const token = await scorerToken(tournamentId);
    const live = { v: 1, first: "a", rallies: "aab" };
    await scorerRecord(token, semis[0].id, "in_progress", [{ a: 2, b: 1 }], null, live);
    let stored = (await matchesOf(db, tournamentId)).find((m) => m.id === semis[0].id)!;
    expect(stored).toMatchObject({ status: "in_progress", court: "1", live });

    await scorerRecord(
      token,
      semis[0].id,
      "completed",
      [{ a: 21, b: 15 }, { a: 21, b: 18 }],
      semis[0].participant_a_id,
    );
    const afterSemi1 = await matchesOf(db, tournamentId);
    stored = afterSemi1.find((m) => m.id === semis[0].id)!;
    // A decided match leaves its court, and a typed result clears the rally log.
    expect(stored).toMatchObject({ status: "completed", court: null, live: null });

    const final = byRound(afterSemi1, "knockout", 2)[0];
    const bronze = afterSemi1.find((m) => m.stage === "third_place")!;
    expect(final.participant_a_id).toBe(semis[0].participant_a_id);
    expect(bronze.participant_a_id).toBe(semis[0].participant_b_id);

    // Court 1 is free again.
    await courtAs(userId, semis[1].id, "1");

    // Semi 2 by walkover, from the organizer.
    await record(userId, semis[1].id, "walkover", [], semis[1].participant_b_id);
    const afterSemis = await matchesOf(db, tournamentId);
    const readyFinal = byRound(afterSemis, "knockout", 2)[0];
    expect(readyFinal.participant_b_id).toBe(semis[1].participant_b_id);

    await record(userId, readyFinal.id, "completed", [{ a: 21, b: 10 }, { a: 21, b: 12 }], readyFinal.participant_a_id);
    expect(await statusOf(db, tournamentId)).toBe("in_progress");

    const readyBronze = afterSemis.find((m) => m.stage === "third_place")!;
    await scorerRecord(token, readyBronze.id, "completed", [{ a: 21, b: 19 }, { a: 21, b: 19 }], readyBronze.participant_a_id);
    expect(await statusOf(db, tournamentId)).toBe("completed");
  });
});

describe("the scorer link", () => {
  it("describes its tournament, and nothing for an unknown token", async () => {
    const userId = await signUp(db);
    const { tournamentId } = await drawKnockout(userId, 2);
    const token = await scorerToken(tournamentId);

    const session = await as(db, ANON, () =>
      db.query<{ s: { id: string; status: string } | null }>("select public.scorer_session($1) as s", [token]),
    );
    expect(session.rows[0].s).toMatchObject({ id: tournamentId, status: "in_progress" });

    const unknown = await as(db, ANON, () =>
      db.query<{ s: unknown }>("select public.scorer_session($1) as s", ["0".repeat(32)]),
    );
    expect(unknown.rows[0].s).toBeNull();
  });

  it("cannot reach another tournament's matches", async () => {
    const userId = await signUp(db);
    const first = await drawKnockout(userId, 2);
    const second = await drawKnockout(userId, 2);
    const [otherMatch] = await matchesOf(db, second.tournamentId);

    const error = await errorOf(
      scorerRecord(await scorerToken(first.tournamentId), otherMatch.id, "completed", [{ a: 21, b: 3 }], otherMatch.participant_a_id),
    );
    expect(error).toBe("not_found");
  });

  it("stops working once replaced", async () => {
    const userId = await signUp(db);
    const { tournamentId } = await drawKnockout(userId, 2);
    const old = await scorerToken(tournamentId);
    const [match] = await matchesOf(db, tournamentId);

    const fresh = await as(db, organizer(userId), () =>
      db.query<{ token: string }>("select public.rotate_scorer_token($1) as token", [tournamentId]),
    );
    expect(fresh.rows[0].token).not.toBe(old);

    expect(
      await errorOf(scorerRecord(old, match.id, "in_progress", [{ a: 1, b: 0 }], null)),
    ).toBe("invalid_token");
    await scorerRecord(fresh.rows[0].token, match.id, "in_progress", [{ a: 1, b: 0 }], null);
  });

  it("is never readable by visitors, and another organizer cannot replace it", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const { tournamentId } = await drawKnockout(owner, 2);

    expect(
      await errorOf(as(db, ANON, () => db.query("select token from public.scorer_tokens"))),
    ).toMatch(/permission denied/);

    const seen = await as(db, organizer(other), () =>
      db.query("select token from public.scorer_tokens where tournament_id = $1", [tournamentId]),
    );
    expect(seen.rows).toHaveLength(0);

    expect(
      await errorOf(
        as(db, organizer(other), () =>
          db.query("select public.rotate_scorer_token($1)", [tournamentId]),
        ),
      ),
    ).toBe("not_found");
  });

  it("leaves the organizer-only functions closed to visitors", async () => {
    const userId = await signUp(db);
    const { tournamentId } = await drawKnockout(userId, 2);
    const [match] = await matchesOf(db, tournamentId);

    expect(
      await errorOf(
        as(db, ANON, () =>
          db.query("select public.record_match_result($1, 'completed', '[]'::jsonb, $2)", [
            match.id,
            match.participant_a_id,
          ]),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await errorOf(as(db, ANON, () => db.query("select public.assign_court($1, '1')", [match.id]))),
    ).toMatch(/permission denied/);
  });
});

describe("another organizer", () => {
  it("cannot record results or move courts on a tournament they can see", async () => {
    const owner = await signUp(db);
    const other = await signUp(db);
    const { tournamentId } = await drawKnockout(owner, 2);
    const [match] = await matchesOf(db, tournamentId);

    expect(
      await errorOf(record(other, match.id, "completed", [{ a: 21, b: 1 }], match.participant_a_id)),
    ).toBe("not_found");
    expect(await errorOf(courtAs(other, match.id, "1"))).toBe("not_found");
  });
});
