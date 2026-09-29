import type { GameScore, Side } from "@/sports/types";
import type { Tiebreaker } from "@/sports/registry";
import { isDecided, type MatchRecord } from "./types";

/**
 * League tables for round-robin tournaments and group stages.
 *
 * Only decided matches count. A walkover counts as a match won and lost; its
 * games and points count only as far as they were actually played, so a
 * no-show does not hand anyone a free 21-0 on point difference.
 */

export type StandingRow = {
  participantId: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  gameDifference: number;
  pointDifference: number;
  /** Most recent last. */
  form: ("W" | "L")[];
};

export type StandingsOptions = {
  tiebreakers: readonly Tiebreaker[];
  /** Decides who won each game, from the sport's scoring engine. */
  gameWinner: (score: GameScore) => Side | null;
  /** Final fallback when everything else is level: seed, then name. */
  seedOf?: (participantId: string) => number | null;
  nameOf?: (participantId: string) => string;
};

export function computeStandings(
  participantIds: string[],
  matches: MatchRecord[],
  options: StandingsOptions,
): StandingRow[] {
  const members = new Set(participantIds);
  const rows = new Map<string, StandingRow>(
    participantIds.map((id) => [id, emptyRow(id)]),
  );

  const counted = matches
    .filter(
      (match) =>
        isDecided(match.status) &&
        match.status !== "bye" &&
        match.participant_a_id !== null &&
        match.participant_b_id !== null &&
        members.has(match.participant_a_id) &&
        members.has(match.participant_b_id),
    )
    .sort((x, y) => (x.number ?? 0) - (y.number ?? 0));

  for (const match of counted) {
    const a = rows.get(match.participant_a_id!)!;
    const b = rows.get(match.participant_b_id!)!;
    const aWon = match.winner_id === match.participant_a_id;

    a.played += 1;
    b.played += 1;
    if (aWon) {
      a.won += 1;
      b.lost += 1;
    } else {
      b.won += 1;
      a.lost += 1;
    }
    a.form.push(aWon ? "W" : "L");
    b.form.push(aWon ? "L" : "W");

    for (const game of match.games) {
      a.pointsFor += game.a;
      a.pointsAgainst += game.b;
      b.pointsFor += game.b;
      b.pointsAgainst += game.a;
      const gameWinner = options.gameWinner(game);
      if (gameWinner === "a") {
        a.gamesWon += 1;
        b.gamesLost += 1;
      } else if (gameWinner === "b") {
        b.gamesWon += 1;
        a.gamesLost += 1;
      }
    }
  }

  for (const row of rows.values()) {
    row.gameDifference = row.gamesWon - row.gamesLost;
    row.pointDifference = row.pointsFor - row.pointsAgainst;
    row.form = row.form.slice(-5);
  }

  const ranked = rank([...rows.values()], options.tiebreakers, counted, options);
  ranked.forEach((row, index) => {
    row.position = index + 1;
  });
  return ranked;
}

/**
 * Split `rows` by the first tiebreaker, then recurse into every group still
 * level with the remaining ones. Head-to-head is computed among exactly the
 * rows still tied at that point — a mini-league — which is what makes it
 * correct for three-way ties rather than only two.
 */
function rank(
  rows: StandingRow[],
  tiebreakers: readonly Tiebreaker[],
  matches: MatchRecord[],
  options: StandingsOptions,
): StandingRow[] {
  if (rows.length <= 1) return rows;
  if (tiebreakers.length === 0) return [...rows].sort((x, y) => fallback(x, y, options));

  const [criterion, ...rest] = tiebreakers;
  const score = scorer(criterion, rows, matches);

  const buckets = new Map<number, StandingRow[]>();
  for (const row of rows) {
    const key = score(row);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  return [...buckets.entries()]
    .sort(([x], [y]) => y - x)
    .flatMap(([, bucket]) => rank(bucket, rest, matches, options));
}

function scorer(
  criterion: Tiebreaker,
  rows: StandingRow[],
  matches: MatchRecord[],
): (row: StandingRow) => number {
  switch (criterion) {
    case "matches_won":
      return (row) => row.won;
    case "game_difference":
      return (row) => row.gameDifference;
    case "point_difference":
      return (row) => row.pointDifference;
    case "head_to_head": {
      const tied = new Set(rows.map((row) => row.participantId));
      const wins = new Map<string, number>();
      for (const match of matches) {
        if (!tied.has(match.participant_a_id!) || !tied.has(match.participant_b_id!)) continue;
        if (match.winner_id) wins.set(match.winner_id, (wins.get(match.winner_id) ?? 0) + 1);
      }
      return (row) => wins.get(row.participantId) ?? 0;
    }
  }
}

function fallback(x: StandingRow, y: StandingRow, options: StandingsOptions): number {
  const seedX = options.seedOf?.(x.participantId) ?? Number.POSITIVE_INFINITY;
  const seedY = options.seedOf?.(y.participantId) ?? Number.POSITIVE_INFINITY;
  if (seedX !== seedY) return seedX - seedY;
  const nameX = options.nameOf?.(x.participantId) ?? x.participantId;
  const nameY = options.nameOf?.(y.participantId) ?? y.participantId;
  return nameX.localeCompare(nameY);
}

function emptyRow(participantId: string): StandingRow {
  return {
    participantId,
    position: 0,
    played: 0,
    won: 0,
    lost: 0,
    gamesWon: 0,
    gamesLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    gameDifference: 0,
    pointDifference: 0,
    form: [],
  };
}

/** Every match between these participants is decided. */
export function isLeagueComplete(matches: MatchRecord[]): boolean {
  return matches.length > 0 && matches.every((match) => isDecided(match.status));
}
