import { describe, expect, it } from "vitest";

import { SCORING_PRESETS, STANDARD_SCORING, scoringPreset } from "@/sports/badminton/rules";
import {
  createBadmintonScoring,
  describeScoring,
  gamePointFor,
  intervalPoint,
  matchPointFor,
  reachedInterval,
  serviceCourt,
} from "@/sports/badminton/scoring";

const standard = createBadmintonScoring(STANDARD_SCORING);

function g(a: number, b: number) {
  return { a, b };
}

describe("badminton game winner (21, win by 2, cap 30)", () => {
  it.each([
    [21, 0, "a"],
    [21, 19, "a"],
    [19, 21, "b"],
    [22, 20, "a"],
    [29, 27, "a"],
    [30, 28, "a"],
    [30, 29, "a"],
    [29, 30, "b"],
  ])("%i-%i is won by %s", (a, b, winner) => {
    expect(standard.gameWinner(g(a, b))).toBe(winner);
  });

  it.each([
    [0, 0],
    [20, 19],
    [21, 20],
    [20, 20],
    [29, 29],
    [28, 29],
  ])("%i-%i is still live", (a, b) => {
    expect(standard.gameWinner(g(a, b))).toBeNull();
  });
});

describe("badminton match validation", () => {
  it("accepts a straight-games win", () => {
    const result = standard.check([g(21, 15), g(21, 18)], { final: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.progress.winner).toBe("a");
      expect(result.progress.gamesWon).toEqual({ a: 2, b: 0 });
      expect(result.progress.points).toEqual({ a: 42, b: 33 });
      expect(result.progress.current).toBeNull();
    }
  });

  it("accepts a three-game win with setting in the decider", () => {
    const result = standard.check([g(19, 21), g(21, 17), g(30, 29)], { final: true });
    expect(result.ok && result.progress.winner).toBe("a");
  });

  /*
   * A game ends the moment it is won, so a final score is only legal if the
   * score one rally earlier was not already a win.
   */
  it.each([
    [22, 19, "would have ended at 21-19"],
    [25, 10, "would have ended at 21-10"],
    [30, 27, "would have ended at 29-27"],
    [23, 20, "would have ended at 22-20"],
  ])("rejects %i-%i (%s)", (a, b) => {
    const result = standard.check([g(a, b), g(21, 0)], { final: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.game).toBe(0);
      expect(result.message).toContain("can't happen");
    }
  });

  it("rejects a score above the cap", () => {
    const result = standard.check([g(31, 29)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("more than 30");
  });

  it("rejects negative, fractional and non-numeric scores", () => {
    expect(standard.check([g(-1, 21)]).ok).toBe(false);
    expect(standard.check([g(20.5, 21)]).ok).toBe(false);
    expect(standard.check([{ a: Number.NaN, b: 3 }]).ok).toBe(false);
  });

  it("rejects an unfinished game that is not the last one", () => {
    const result = standard.check([g(20, 18), g(21, 10)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.game).toBe(0);
  });

  it("rejects a game played after the match was decided", () => {
    const result = standard.check([g(21, 10), g(21, 10), g(21, 10)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already won");
  });

  it("rejects more games than best-of allows", () => {
    expect(standard.check([g(21, 0), g(0, 21), g(21, 0), g(0, 21)]).ok).toBe(false);
  });

  it("allows a live final game when not final", () => {
    const result = standard.check([g(21, 18), g(14, 11)]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.progress.winner).toBeNull();
      expect(result.progress.current).toBe(1);
    }
  });

  it("points at the next game when every recorded game is finished", () => {
    const result = standard.check([g(21, 18), g(18, 21)]);
    expect(result.ok && result.progress.current).toBe(2);
  });

  it("refuses an undecided match as a final result", () => {
    const live = standard.check([g(21, 18), g(14, 11)], { final: true });
    expect(live.ok).toBe(false);

    const level = standard.check([g(21, 18), g(18, 21)], { final: true });
    expect(level.ok).toBe(false);
    if (!level.ok) expect(level.message).toContain("1-1 in games");
  });

  it("treats an empty match as not started", () => {
    const result = standard.check([]);
    expect(result.ok && result.progress.current).toBe(0);
    expect(standard.check([], { final: true }).ok).toBe(false);
  });
});

describe("scoring presets", () => {
  it("one game to 30 has no setting: 30-29 ends it, 29-28 does not", () => {
    const engine = createBadmintonScoring(scoringPreset("single-30").rules);
    expect(engine.check([g(30, 29)], { final: true }).ok).toBe(true);
    expect(engine.check([g(30, 0)], { final: true }).ok).toBe(true);
    expect(engine.gameWinner(g(29, 28))).toBeNull();
    expect(engine.check([g(30, 29), g(1, 0)]).ok).toBe(false);
  });

  it("best of 3 to 15 caps at 21", () => {
    const engine = createBadmintonScoring(scoringPreset("best-of-3-15").rules);
    expect(engine.check([g(15, 13), g(21, 20)], { final: true }).ok).toBe(true);
    expect(engine.check([g(16, 13)]).ok).toBe(false);
    expect(engine.check([g(22, 20)]).ok).toBe(false);
  });

  it("best of 5 to 11 needs three games", () => {
    const engine = createBadmintonScoring(scoringPreset("best-of-5-11").rules);
    expect(engine.gamesToWin).toBe(3);
    expect(engine.check([g(11, 9), g(11, 9)], { final: true }).ok).toBe(false);
    expect(engine.check([g(11, 9), g(11, 9), g(15, 14)], { final: true }).ok).toBe(true);
  });

  it("falls back to standard for an unknown preset id", () => {
    expect(scoringPreset("nonsense").rules).toEqual(STANDARD_SCORING);
  });

  it("describes every preset in one line", () => {
    for (const preset of SCORING_PRESETS) {
      expect(describeScoring(preset.rules).length).toBeGreaterThan(5);
    }
    expect(describeScoring(STANDARD_SCORING)).toBe("Best of 3 to 21, win by 2, capped at 30");
  });
});

describe("court-side helpers", () => {
  it("serves from the right on an even score", () => {
    expect(serviceCourt(0)).toBe("right");
    expect(serviceCourt(7)).toBe("left");
    expect(serviceCourt(20)).toBe("right");
  });

  it("calls the interval when the leader first reaches 11", () => {
    expect(intervalPoint(STANDARD_SCORING)).toBe(11);
    expect(reachedInterval(g(10, 8), g(11, 8), STANDARD_SCORING)).toBe(true);
    expect(reachedInterval(g(11, 8), g(11, 9), STANDARD_SCORING)).toBe(false);
    expect(reachedInterval(g(10, 10), g(10, 11), STANDARD_SCORING)).toBe(true);
  });

  it("spots game point and match point", () => {
    expect(gamePointFor(standard, g(20, 18))).toBe("a");
    expect(gamePointFor(standard, g(20, 20))).toBeNull();
    expect(gamePointFor(standard, g(29, 29))).toBe("a");
    expect(matchPointFor(standard, { a: 1, b: 0 }, g(20, 15))).toBe("a");
    expect(matchPointFor(standard, { a: 0, b: 0 }, g(20, 15))).toBeNull();
  });
});
