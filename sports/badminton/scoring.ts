import {
  SIDES,
  otherSide,
  type GameScore,
  type MatchProgress,
  type ScoreCheck,
  type ScoringEngine,
  type Side,
} from "../types";
import type { BadmintonScoringRules } from "./rules";

/**
 * Badminton rally scoring.
 *
 * A game is won by the first side to reach `pointsToWin` with a lead of
 * `winBy`, or by the first to reach `hardCap` regardless of margin — 21, win
 * by two, 30 at 29-all under BWF rules.
 *
 * The one idea everything below leans on: **a game ends the instant it is
 * won**. So a finished score is legal exactly when it is a win *and* the score
 * one point earlier was not. That single check rejects 22-19 (over at 21-19),
 * 30-27 (over at 29-27) and 25-10 while accepting 30-28 and 30-29, without a
 * table of special cases.
 */
export function createBadmintonScoring(rules: BadmintonScoringRules): ScoringEngine {
  const gamesToWin = Math.floor(rules.bestOf / 2) + 1;
  // A cap below the target would end every game early; treat it as absent.
  const cap = rules.hardCap !== null && rules.hardCap >= rules.pointsToWin ? rules.hardCap : null;

  function gameWinner(score: GameScore): Side | null {
    for (const side of SIDES) {
      const own = score[side];
      const theirs = score[otherSide(side)];
      if (own <= theirs) continue;
      if (cap !== null && own >= cap) return side;
      if (own >= rules.pointsToWin && own - theirs >= rules.winBy) return side;
    }
    return null;
  }

  function endsRule(): string {
    if (rules.winBy <= 1) return `a game ends when a side reaches ${rules.pointsToWin}`;
    const capText = cap !== null ? `, or at ${cap}` : "";
    return `a game ends when a side reaches ${rules.pointsToWin} with a ${rules.winBy}-point lead${capText}`;
  }

  function check(games: GameScore[], options: { final?: boolean } = {}): ScoreCheck {
    const final = options.final ?? false;

    if (games.length > rules.bestOf) {
      return {
        ok: false,
        message: `A best-of-${rules.bestOf} match has at most ${rules.bestOf} game${rules.bestOf === 1 ? "" : "s"}.`,
      };
    }

    const gamesWon = { a: 0, b: 0 };
    const points = { a: 0, b: 0 };
    let decided: Side | null = null;
    let liveGame: number | null = null;

    for (const [index, game] of games.entries()) {
      const label = `Game ${index + 1}`;

      if (!isScore(game.a) || !isScore(game.b)) {
        return { ok: false, game: index, message: `${label}: scores must be whole numbers, zero or more.` };
      }
      if (cap !== null && (game.a > cap || game.b > cap)) {
        return { ok: false, game: index, message: `${label}: no side can score more than ${cap}.` };
      }
      if (decided) {
        return {
          ok: false,
          game: index,
          message: `The match was already won after game ${index}. Remove game ${index + 1}.`,
        };
      }

      points.a += game.a;
      points.b += game.b;

      const winner = gameWinner(game);
      if (winner) {
        const oneEarlier = { ...game, [winner]: game[winner] - 1 };
        if (gameWinner(oneEarlier) !== null) {
          return {
            ok: false,
            game: index,
            message: `${label}: ${game.a}-${game.b} can't happen — ${endsRule()}.`,
          };
        }
        gamesWon[winner] += 1;
        if (gamesWon[winner] >= gamesToWin) decided = winner;
        continue;
      }

      // Unfinished. Only the last game may be, and only while scoring live.
      if (index < games.length - 1) {
        return {
          ok: false,
          game: index,
          message: `${label} is not finished at ${game.a}-${game.b} — ${endsRule()}.`,
        };
      }
      if (final) {
        return {
          ok: false,
          game: index,
          message: `${label} is not finished at ${game.a}-${game.b} — ${endsRule()}.`,
        };
      }
      liveGame = index;
    }

    if (final && !decided) {
      return {
        ok: false,
        message: `The match is not decided yet — it is ${gamesWon.a}-${gamesWon.b} in games, and a side needs ${gamesToWin}.`,
      };
    }

    const progress: MatchProgress = {
      gamesWon,
      points,
      winner: decided,
      current: decided ? null : (liveGame ?? games.length),
    };
    return { ok: true, progress };
  }

  return {
    summary: describeScoring(rules),
    gamesToWin,
    maxGames: rules.bestOf,
    gameWinner,
    check,
  };
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function describeScoring(rules: BadmintonScoringRules): string {
  const head =
    rules.bestOf === 1
      ? `One game to ${rules.pointsToWin}`
      : `Best of ${rules.bestOf} to ${rules.pointsToWin}`;
  if (rules.winBy <= 1) return head;
  const capText =
    rules.hardCap !== null && rules.hardCap > rules.pointsToWin ? `, capped at ${rules.hardCap}` : "";
  return `${head}, win by ${rules.winBy}${capText}`;
}

// -----------------------------------------------------------------------------
// Court-side helpers for the live scorer
// -----------------------------------------------------------------------------

/**
 * Service court under rally scoring: the server serves from the right court on
 * an even score of their own and from the left on an odd one.
 */
export function serviceCourt(serverScore: number): "right" | "left" {
  return serverScore % 2 === 0 ? "right" : "left";
}

/**
 * The score at which the leading side triggers the mid-game interval — 11 in a
 * 21-point game. In the deciding game, ends change here too.
 */
export function intervalPoint(rules: BadmintonScoringRules): number {
  return Math.ceil(rules.pointsToWin / 2);
}

/** True when this rally is the one that brought the leader to the interval. */
export function reachedInterval(
  before: GameScore,
  after: GameScore,
  rules: BadmintonScoringRules,
): boolean {
  const at = intervalPoint(rules);
  return Math.max(before.a, before.b) < at && Math.max(after.a, after.b) === at;
}

/** Index of the game that would decide the match if the sides are level. */
export function isDecidingGame(index: number, rules: BadmintonScoringRules): boolean {
  return rules.bestOf > 1 && index === rules.bestOf - 1;
}

/** The side one rally away from winning this game, if any. */
export function gamePointFor(engine: ScoringEngine, score: GameScore): Side | null {
  if (engine.gameWinner(score) !== null) return null;
  for (const side of SIDES) {
    if (engine.gameWinner({ ...score, [side]: score[side] + 1 }) === side) return side;
  }
  return null;
}

/** The side one rally away from winning the match, if any. */
export function matchPointFor(
  engine: ScoringEngine,
  gamesWon: Record<Side, number>,
  score: GameScore,
): Side | null {
  const side = gamePointFor(engine, score);
  if (side && gamesWon[side] === engine.gamesToWin - 1) return side;
  return null;
}
