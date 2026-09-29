/**
 * Tournament engine vocabulary. Sport-agnostic: nothing in lib/tournament
 * knows what a badminton game is — see sports/types.ts for that seam.
 *
 * String unions mirror the CHECK constraints in the core schema migration.
 */

export type TournamentFormat = "knockout" | "round_robin" | "groups_knockout";
export type TournamentStatus = "draft" | "registration" | "in_progress" | "completed";
export type ParticipantStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type MatchStage = "league" | "group" | "knockout" | "third_place";
export type MatchStatus = "scheduled" | "in_progress" | "completed" | "walkover" | "bye";
export type Slot = "a" | "b";

export const FORMATS: Record<TournamentFormat, { label: string; detail: string }> = {
  knockout: {
    label: "Knockout",
    detail: "Single elimination. Lose once and you are out. Byes go to the top seeds.",
  },
  round_robin: {
    label: "Round robin",
    detail: "Everyone plays everyone once. The table decides the winner.",
  },
  groups_knockout: {
    label: "Groups, then knockout",
    detail: "Round-robin groups, then the top of each group plays a knockout.",
  },
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Draft",
  registration: "Registration",
  in_progress: "In play",
  completed: "Completed",
};

/** Match states that have a winner. */
export const DECIDED_STATUSES: readonly MatchStatus[] = ["completed", "walkover", "bye"];

export function isDecided(status: MatchStatus): boolean {
  return DECIDED_STATUSES.includes(status);
}

/**
 * A match as the fixture planner emits it. Field names are the column names:
 * this array is sent to `generate_fixtures()` as-is.
 */
export type PlannedMatch = {
  id: string;
  stage: MatchStage;
  group_label: string | null;
  round: number;
  position: number;
  number: number | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
  status: "scheduled" | "bye";
  winner_id: string | null;
  next_match_id: string | null;
  next_slot: Slot | null;
  loser_next_match_id: string | null;
  loser_next_slot: Slot | null;
};

/** The subset of a stored match the engine reads. A `matches` row satisfies it. */
export type MatchRecord = {
  id: string;
  stage: MatchStage;
  group_label: string | null;
  round: number;
  position: number;
  number: number | null;
  participant_a_id: string | null;
  participant_b_id: string | null;
  status: MatchStatus;
  winner_id: string | null;
  games: { a: number; b: number }[];
};

export type IdFactory = () => string;

export const randomId: IdFactory = () => crypto.randomUUID();

/** Raised when a draw cannot be built from the entries given. */
export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}
