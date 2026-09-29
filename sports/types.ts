/**
 * The contract between the tournament engine and a sport.
 *
 * The engine (fixtures, brackets, standings) never knows what a badminton
 * game is. It sees matches made of games, each game a pair of scores, and asks
 * the sport's scoring engine whether those scores are legal and who won. That
 * is the whole seam — a new sport plugs in by implementing `ScoringEngine`.
 */

export type Side = "a" | "b";

export const SIDES: readonly Side[] = ["a", "b"];

export function otherSide(side: Side): Side {
  return side === "a" ? "b" : "a";
}

/** One game's score, as stored in `matches.games`. */
export type GameScore = { a: number; b: number };

export type SideCounts = Record<Side, number>;

/** Where a match stands, derived from its games. */
export type MatchProgress = {
  gamesWon: SideCounts;
  /** Total points across every game, for point difference in standings. */
  points: SideCounts;
  /** Set once one side has won enough games. */
  winner: Side | null;
  /**
   * Index of the game being played, or null when the match is decided. When
   * every recorded game is finished and the match is not, this is the index
   * of the game that has not started yet.
   */
  current: number | null;
};

export type ScoreCheck =
  | { ok: true; progress: MatchProgress }
  | { ok: false; message: string; game?: number };

export interface ScoringEngine {
  /** One line, for tiles and the scoring screen: "Best of 3 to 21, cap 30". */
  readonly summary: string;
  /** Games a side must win to take the match. */
  readonly gamesToWin: number;
  /** Most games a match can last. */
  readonly maxGames: number;
  /** The side that has won this game, or null while it is still live. */
  gameWinner(score: GameScore): Side | null;
  /**
   * Validate a sequence of games.
   * - `final: true` — the match must be decided (entering a result).
   * - `final: false` — the last game may still be in progress (live scoring,
   *   or a retirement mid-game).
   */
  check(games: GameScore[], options?: { final?: boolean }): ScoreCheck;
}
