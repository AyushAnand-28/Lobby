import { describe, expect, it } from "vitest";

import { replay, type LiveState } from "@/lib/scoring/rallies";
import { liveHints } from "@/sports/live";
import { getScoringEngine } from "@/sports/registry";

const SETTINGS = { entryType: "singles", scoringPreset: "standard" };
const engine = getScoringEngine("badminton", SETTINGS);

function hintsAfter(rallies: string, first: "a" | "b" = "a") {
  const state: LiveState = { v: 1, first, rallies };
  const previous = rallies.length > 0 ? replay(engine, { ...state, rallies: rallies.slice(0, -1) }) : null;
  return liveHints("badminton", SETTINGS, engine, replay(engine, state), previous);
}

describe("badminton live hints", () => {
  it("serves from the right court on the server's even score, the left on odd", () => {
    expect(hintsAfter("").serviceCourt).toBe("right");
    expect(hintsAfter("a").serviceCourt).toBe("left");
    expect(hintsAfter("ab").serviceCourt).toBe("left"); // b serves on 1
    expect(hintsAfter("abb").serviceCourt).toBe("right"); // b serves on 2
  });

  it("calls game point, then match point in the game that can decide it", () => {
    expect(hintsAfter("a".repeat(20))).toMatchObject({ gamePoint: "a", matchPoint: null });
    // a won game 1 21-0; at 20-0 in game 2 it is match point, not just game point.
    expect(hintsAfter("a".repeat(21) + "a".repeat(20))).toMatchObject({ gamePoint: null, matchPoint: "a" });
    // At 20-all nobody is a rally from winning.
    expect(hintsAfter("ab".repeat(20))).toMatchObject({ gamePoint: null, matchPoint: null });
  });

  it("marks the interval on the rally that reaches 11, and ends change only in the deciding game", () => {
    expect(hintsAfter("a".repeat(11))).toMatchObject({ interval: true, changeEnds: false });
    expect(hintsAfter("a".repeat(12)).interval).toBe(false);

    // One game each, then 11-0 in the third.
    const deciding = "a".repeat(21) + "b".repeat(21) + "a".repeat(11);
    expect(hintsAfter(deciding)).toMatchObject({ interval: true, changeEnds: true });
  });

  it("offers nothing once the match is won", () => {
    expect(hintsAfter("a".repeat(42))).toEqual({
      gamePoint: null,
      matchPoint: null,
      serviceCourt: null,
      interval: false,
      changeEnds: false,
    });
  });

  it("gives a sport without court rules only game and match point", () => {
    const generic = getScoringEngine("kabaddi", null);
    const state: LiveState = { v: 1, first: "a", rallies: "" };
    const hints = liveHints("kabaddi", null, generic, replay(generic, state), null);
    expect(hints.serviceCourt).toBeNull();
    expect(hints.interval).toBe(false);
  });
});
