import type { GameScore, MatchProgress, ScoreCheck, ScoringEngine, Side } from "../types";

/**
 * Fallback scoring for a sport with no engine of its own: each game is simply
 * won by the higher score, and a level game is not finished.
 *
 * It knows nothing about targets or margins, so it cannot tell 21-19 from
 * 3-1. That is the point of a fallback — every sport still gets a working
 * result form and standings — and why a live sport ships its own engine.
 */
export function createGenericScoring(bestOf = 1): ScoringEngine {
  const maxGames = Math.max(1, Math.floor(bestOf) | 1);
  const gamesToWin = Math.floor(maxGames / 2) + 1;

  function gameWinner(score: GameScore): Side | null {
    if (score.a === score.b) return null;
    return score.a > score.b ? "a" : "b";
  }

  function check(games: GameScore[], options: { final?: boolean } = {}): ScoreCheck {
    if (games.length > maxGames) {
      return { ok: false, message: `A match has at most ${maxGames} game${maxGames === 1 ? "" : "s"}.` };
    }

    const gamesWon = { a: 0, b: 0 };
    const points = { a: 0, b: 0 };
    let decided: Side | null = null;
    let live: number | null = null;

    for (const [index, game] of games.entries()) {
      if (![game.a, game.b].every((n) => Number.isInteger(n) && n >= 0)) {
        return { ok: false, game: index, message: `Game ${index + 1}: scores must be whole numbers.` };
      }
      if (decided) {
        return { ok: false, game: index, message: `The match was already won after game ${index}.` };
      }
      points.a += game.a;
      points.b += game.b;

      const winner = gameWinner(game);
      if (winner) {
        gamesWon[winner] += 1;
        if (gamesWon[winner] >= gamesToWin) decided = winner;
      } else if (index < games.length - 1 || options.final) {
        return { ok: false, game: index, message: `Game ${index + 1} is level — it has no winner yet.` };
      } else {
        live = index;
      }
    }

    if (options.final && !decided) {
      return { ok: false, message: "The match is not decided yet." };
    }

    const progress: MatchProgress = {
      gamesWon,
      points,
      winner: decided,
      current: decided ? null : (live ?? games.length),
    };
    return { ok: true, progress };
  }

  return {
    summary: maxGames === 1 ? "One game, higher score wins" : `Best of ${maxGames} games`,
    gamesToWin,
    maxGames,
    gameWinner,
    check,
  };
}
