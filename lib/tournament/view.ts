import { getScoringEngine, getSport } from "@/sports/registry";
import type { GameScore, Side } from "@/sports/types";
import { podium, type Podium } from "./podium";
import { knockoutRounds, matchLabel } from "./rounds";
import { computeStandings, isLeagueComplete, type StandingRow } from "./standings";
import {
  isDecided,
  type MatchRecord,
  type ParticipantStatus,
  type Slot,
  type TournamentFormat,
  type TournamentStatus,
} from "./types";

/**
 * One read model for every screen that shows a draw: the organizer's matches
 * and standings, the scorer link, and the public page. Built from plain rows,
 * so it is the same whether those rows came through the organizer's session
 * or a spectator's.
 */

export const ENTRY_COLUMNS = "id, name, players, club, seed, group_label, status";

export const MATCH_COLUMNS =
  "id, tournament_id, stage, group_label, round, position, number, participant_a_id, " +
  "participant_b_id, status, winner_id, games, court, live, next_match_id, next_slot, " +
  "loser_next_match_id, loser_next_slot, started_at, completed_at";

export type EntryRow = {
  id: string;
  name: string;
  players: string[];
  club: string | null;
  seed: number | null;
  group_label: string | null;
  status: ParticipantStatus;
};

export type MatchRow = MatchRecord & {
  tournament_id: string;
  court: string | null;
  live: unknown;
  next_match_id: string | null;
  next_slot: Slot | null;
  loser_next_match_id: string | null;
  loser_next_slot: Slot | null;
  started_at: string | null;
  completed_at: string | null;
};

/** The tournament fields the view reads. */
export type TournamentShape = {
  sport: string;
  settings: unknown;
  format: TournamentFormat;
  status: TournamentStatus;
  advance_per_group: number | null;
  court_count: number | null;
};

export type Table = {
  /** "A".."H" for a group, null for the league. */
  label: string | null;
  rows: StandingRow[];
  matches: MatchRow[];
  complete: boolean;
};

export type TournamentView = {
  entries: Map<string, EntryRow>;
  /** In order of play: numbered matches first, byes last. */
  matches: MatchRow[];
  byId: Map<string, MatchRow>;
  totalKnockoutRounds: number;
  /** Knockout rounds, first round first, each in bracket order. */
  knockout: MatchRow[][];
  thirdPlace: MatchRow | null;
  groups: Table[];
  league: Table | null;
  podium: Podium | null;
  /** Matches on a court now, by court number. */
  onCourt: MatchRow[];
  /** Ready to play — both sides known — but not on a court. */
  upNext: MatchRow[];
  /** Waiting for an earlier result to fill a side. */
  waiting: MatchRow[];
  /** Played, most recent first. Byes are left out. */
  finished: MatchRow[];
  groupStageComplete: boolean;
  knockoutDrawn: boolean;
  /** Groups-then-knockout with every group decided and no knockout yet. */
  needsKnockoutDraw: boolean;
};

export function byPlayOrder(x: MatchRow, y: MatchRow): number {
  if (x.number !== null && y.number !== null) return x.number - y.number;
  if (x.number !== null) return -1;
  if (y.number !== null) return 1;
  return x.round - y.round || x.position - y.position;
}

export function buildTournamentView(
  tournament: TournamentShape,
  entryRows: EntryRow[],
  matchRows: MatchRow[],
): TournamentView {
  const entries = new Map(entryRows.map((entry) => [entry.id, entry]));
  const matches = [...matchRows].sort(byPlayOrder);
  const byId = new Map(matches.map((match) => [match.id, match]));

  const totalKnockoutRounds = knockoutRounds(matches);
  const knockout = Array.from({ length: totalKnockoutRounds }, (_, index) =>
    matches
      .filter((match) => match.stage === "knockout" && match.round === index + 1)
      .sort((x, y) => x.position - y.position),
  );
  const thirdPlace = matches.find((match) => match.stage === "third_place") ?? null;

  const engine = getScoringEngine(tournament.sport, tournament.settings);
  const standingsOptions = {
    tiebreakers: getSport(tournament.sport).tiebreakers,
    gameWinner: (score: GameScore) => engine.gameWinner(score),
    seedOf: (id: string) => entries.get(id)?.seed ?? null,
    nameOf: (id: string) => entries.get(id)?.name ?? "",
  };

  function table(label: string | null, tableMatches: MatchRow[]): Table {
    // Members are whoever the draw put in this table. Reading them from the
    // matches rather than entry status keeps a withdrawn entry in the table.
    const members = new Set<string>();
    for (const match of tableMatches) {
      if (match.participant_a_id) members.add(match.participant_a_id);
      if (match.participant_b_id) members.add(match.participant_b_id);
    }
    for (const entry of entryRows) {
      if (label !== null && entry.group_label === label) members.add(entry.id);
    }
    return {
      label,
      rows: computeStandings([...members], tableMatches, standingsOptions),
      matches: tableMatches,
      complete: isLeagueComplete(tableMatches),
    };
  }

  const groupLabels = [
    ...new Set(
      matches.filter((match) => match.stage === "group").map((match) => match.group_label!),
    ),
  ].sort();
  const groups = groupLabels.map((label) =>
    table(
      label,
      matches.filter((match) => match.stage === "group" && match.group_label === label),
    ),
  );

  const leagueMatches = matches.filter((match) => match.stage === "league");
  const league = leagueMatches.length > 0 ? table(null, leagueMatches) : null;

  const groupStageComplete = groups.length > 0 && groups.every((group) => group.complete);
  const knockoutDrawn = totalKnockoutRounds > 0;

  const playable = matches.filter((match) => match.status !== "bye");
  const open = playable.filter((match) => !isDecided(match.status));
  const ready = (match: MatchRow) =>
    match.participant_a_id !== null && match.participant_b_id !== null;

  return {
    entries,
    matches,
    byId,
    totalKnockoutRounds,
    knockout,
    thirdPlace,
    groups,
    league,
    podium: podium(tournament.format, matches, league?.rows ?? null),
    onCourt: open
      .filter((match) => match.court !== null)
      .sort((x, y) => Number(x.court) - Number(y.court)),
    upNext: open.filter((match) => match.court === null && ready(match)),
    waiting: open.filter((match) => !ready(match)),
    finished: playable
      .filter((match) => isDecided(match.status))
      .sort((x, y) => timeOf(y.completed_at) - timeOf(x.completed_at)),
    groupStageComplete,
    knockoutDrawn,
    needsKnockoutDraw:
      tournament.format === "groups_knockout" && groupStageComplete && !knockoutDrawn,
  };
}

/** Milliseconds for a timestamp, whether it arrives as an ISO string or a Date. */
function timeOf(value: string | Date | null): number {
  return value ? new Date(value).getTime() : 0;
}

/** "Semi-final 2", "Group B · Round 3". */
export function matchTitle(view: TournamentView, match: MatchRow): string {
  return matchLabel(match, view.totalKnockoutRounds);
}

/**
 * Who is in a slot, in words. An empty knockout slot names the match that
 * fills it — "Winner of match 12" — so a bracket reads before it is played.
 */
export function sideName(view: TournamentView, match: MatchRow, side: Side): string {
  const id = side === "a" ? match.participant_a_id : match.participant_b_id;
  if (id) return view.entries.get(id)?.name ?? "Unknown entry";
  if (match.status === "bye") return "Bye";

  for (const feeder of view.matches) {
    if (feeder.next_match_id === match.id && feeder.next_slot === side) {
      if (feeder.status === "bye") return "Bye";
      return `Winner of ${feederName(view, feeder)}`;
    }
    if (feeder.loser_next_match_id === match.id && feeder.loser_next_slot === side) {
      return `Loser of ${feederName(view, feeder)}`;
    }
  }
  return "To be decided";
}

function feederName(view: TournamentView, feeder: MatchRow): string {
  return feeder.number !== null ? `match ${feeder.number}` : matchTitle(view, feeder).toLowerCase();
}

/** The side that won, or null. */
export function winnerSide(match: MatchRow): Side | null {
  if (!match.winner_id) return null;
  return match.winner_id === match.participant_a_id ? "a" : "b";
}

/** "21-15, 19-21, 21-17" from the first side's point of view. */
export function formatGames(games: GameScore[]): string {
  return games.map((game) => `${game.a}-${game.b}`).join(", ");
}

/** A match flattened to plain data, for client components. */
export type MatchSummary = {
  id: string;
  number: number | null;
  title: string;
  a: string;
  b: string;
  status: MatchRow["status"];
  games: GameScore[];
  court: string | null;
};

/** What the scoring screen needs: the summary, the rally log, who won. */
export type ScorerMatch = MatchSummary & { live: unknown; winner: Side | null };

export function summarise(view: TournamentView, match: MatchRow): MatchSummary {
  return {
    id: match.id,
    number: match.number,
    title: matchTitle(view, match),
    a: sideName(view, match, "a"),
    b: sideName(view, match, "b"),
    status: match.status,
    games: match.games,
    court: match.court,
  };
}

/** Courts 1..n with whatever is on each, for the court board. */
export function courtBoard(
  view: TournamentView,
  courtCount: number | null,
): { court: string; match: MatchRow | null }[] {
  if (!courtCount) return [];
  return Array.from({ length: courtCount }, (_, index) => {
    const court = String(index + 1);
    return { court, match: view.onCourt.find((match) => match.court === court) ?? null };
  });
}
