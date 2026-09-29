import type { GameScore, ScoringEngine, Side, SideCounts } from "@/sports/types";

/**
 * Live scoring as a rally log.
 *
 * A match scored point by point is stored as who won each rally, in order —
 * `"aabab..."` — plus who served first. Everything a scorer's screen shows is
 * replayed from that: the games, who serves next, game and match point. It
 * makes undo trivial (drop the last rally), makes the state tiny enough to
 * save on every tap, and means a second phone picking up the match sees
 * exactly what the first one did.
 *
 * Rally-point sports only: every rally scores a point for its winner, and the
 * winner serves next. The winner of a game serves first in the next one.
 */

export type LiveState = {
  v: 1;
  /** Who served the first rally of the match — the toss. */
  first: Side;
  /** Rally winners in order, one character each. */
  rallies: string;
};

export type LiveSnapshot = {
  /** Every game with a point in it, the current one last while it is live. */
  games: GameScore[];
  /** The score of the game being played; 0-0 at the start of a game. */
  current: GameScore;
  /** Index of `current` among the games of the match. */
  currentIndex: number;
  gamesWon: SideCounts;
  /** Who serves the next rally. Null once the match is decided. */
  server: Side | null;
  /** Set once a side has won enough games. */
  winner: Side | null;
  /** Rallies that counted. Any after the winning rally are ignored. */
  counted: number;
};

/** Far above any real badminton match (5 games of 29-all is under 300). */
export const MAX_RALLIES = 600;

export function startLive(first: Side): LiveState {
  return { v: 1, first, rallies: "" };
}

/** Read a stored `matches.live` value. Null when absent or not a rally log. */
export function parseLiveState(raw: unknown): LiveState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<LiveState>;
  if (value.v !== 1) return null;
  if (value.first !== "a" && value.first !== "b") return null;
  if (typeof value.rallies !== "string" || !/^[ab]*$/.test(value.rallies)) return null;
  if (value.rallies.length > MAX_RALLIES) return null;
  return { v: 1, first: value.first, rallies: value.rallies };
}

export function replay(engine: ScoringEngine, state: LiveState): LiveSnapshot {
  const finished: GameScore[] = [];
  const gamesWon: SideCounts = { a: 0, b: 0 };
  let current: GameScore = { a: 0, b: 0 };
  let server: Side | null = state.first;
  let winner: Side | null = null;
  let counted = 0;

  for (const char of state.rallies) {
    // Rallies after the match was won are ignored rather than trusted.
    if (winner) break;
    counted += 1;
    const side = char as Side;
    current = { ...current, [side]: current[side] + 1 };
    server = side;

    if (engine.gameWinner(current) === side) {
      finished.push(current);
      gamesWon[side] += 1;
      if (gamesWon[side] >= engine.gamesToWin) {
        winner = side;
        server = null;
      } else {
        current = { a: 0, b: 0 };
      }
    }
  }

  const live = !winner && (current.a > 0 || current.b > 0);
  return {
    games: live ? [...finished, current] : finished,
    current: winner ? finished[finished.length - 1] : current,
    currentIndex: winner ? finished.length - 1 : finished.length,
    gamesWon,
    server,
    winner,
    counted,
  };
}

/** Add a rally won by `side`. Unchanged once the match is decided. */
export function addRally(engine: ScoringEngine, state: LiveState, side: Side): LiveState {
  if (replay(engine, state).winner) return state;
  if (state.rallies.length >= MAX_RALLIES) return state;
  return { ...state, rallies: state.rallies + side };
}

export function undoRally(state: LiveState): LiveState {
  return { ...state, rallies: state.rallies.slice(0, -1) };
}

/**
 * Keep only the rallies that count. A log posted by a client is trimmed
 * rather than rejected when it runs past the end of the match.
 */
export function normaliseLive(engine: ScoringEngine, state: LiveState): LiveState {
  return { ...state, rallies: state.rallies.slice(0, replay(engine, state).counted) };
}
