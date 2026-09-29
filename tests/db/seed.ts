import type { PGlite } from "@electric-sql/pglite";

import { as, organizer } from "./harness";

/**
 * Builders for database tests. Each writes through the organizer's own
 * session, so a test that passes here passes under RLS.
 */

type TournamentOptions = {
  format?: "knockout" | "round_robin" | "groups_knockout";
  status?: "draft" | "registration";
  rosterMin?: number;
  rosterMax?: number;
  maxParticipants?: number | null;
  groupCount?: number | null;
  advancePerGroup?: number | null;
  thirdPlace?: boolean;
};

export async function createTournament(
  db: PGlite,
  userId: string,
  options: TournamentOptions = {},
): Promise<string> {
  const format = options.format ?? "knockout";
  const grouped = format === "groups_knockout";

  return as(db, organizer(userId), async () => {
    const result = await db.query<{ id: string }>(
      `insert into public.tournaments
         (sport, slug, name, format, roster_min, roster_max, max_participants,
          group_count, advance_per_group, third_place_match, settings)
       values ('badminton', $1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb)
       returning id`,
      [
        `t-${crypto.randomUUID().slice(0, 8)}`,
        "Test Open",
        format,
        options.rosterMin ?? 1,
        options.rosterMax ?? 1,
        options.maxParticipants ?? null,
        grouped ? (options.groupCount ?? 2) : null,
        grouped ? (options.advancePerGroup ?? 2) : null,
        options.thirdPlace ?? false,
      ],
    );
    const id = result.rows[0].id;
    if ((options.status ?? "registration") === "registration") {
      await db.query("update public.tournaments set status = 'registration' where id = $1", [id]);
    }
    return id;
  });
}

/** Add entries as the organizer and approve them. Returns ids in order. */
export async function addApprovedEntries(
  db: PGlite,
  userId: string,
  tournamentId: string,
  count: number,
): Promise<string[]> {
  return as(db, organizer(userId), async () => {
    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      const result = await db.query<{ id: string }>(
        `insert into public.participants (tournament_id, name, players, status)
         values ($1, $2, array[$2], 'approved') returning id`,
        [tournamentId, `Player ${i}`],
      );
      ids.push(result.rows[0].id);
    }
    return ids;
  });
}

export async function activeToken(db: PGlite, tournamentId: string): Promise<string> {
  const result = await db.query<{ token: string }>(
    "select token from public.registration_tokens where tournament_id = $1 and revoked_at is null",
    [tournamentId],
  );
  return result.rows[0].token;
}

export type MatchRow = {
  id: string;
  stage: string;
  group_label: string | null;
  round: number;
  position: number;
  number: number | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
  status: string;
  winner_id: string | null;
  games: { a: number; b: number }[];
  next_match_id: string | null;
  next_slot: string | null;
};

export async function matchesOf(db: PGlite, tournamentId: string): Promise<MatchRow[]> {
  const result = await db.query<MatchRow>(
    "select * from public.matches where tournament_id = $1 order by stage, group_label, round, position",
    [tournamentId],
  );
  return result.rows;
}

export async function statusOf(db: PGlite, tournamentId: string): Promise<string> {
  const result = await db.query<{ status: string }>(
    "select status from public.tournaments where id = $1",
    [tournamentId],
  );
  return result.rows[0].status;
}
