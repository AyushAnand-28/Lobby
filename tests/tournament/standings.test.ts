import { describe, expect, it } from "vitest";

import { computeStandings } from "@/lib/tournament/standings";
import { podium } from "@/lib/tournament/podium";
import type { MatchRecord, MatchStatus } from "@/lib/tournament/types";
import { STANDARD_SCORING } from "@/sports/badminton/rules";
import { createBadmintonScoring } from "@/sports/badminton/scoring";
import { SPORTS } from "@/sports/registry";

const engine = createBadmintonScoring(STANDARD_SCORING);
const options = {
  tiebreakers: SPORTS.badminton.tiebreakers,
  gameWinner: engine.gameWinner,
};

let number = 0;
function match(
  a: string,
  b: string,
  games: [number, number][],
  status: MatchStatus = "completed",
  winner?: string,
): MatchRecord {
  number += 1;
  const scored = games.map(([x, y]) => ({ a: x, b: y }));
  const progress = engine.check(scored);
  const inferred = progress.ok && progress.progress.winner ? (progress.progress.winner === "a" ? a : b) : null;
  return {
    id: `m${number}`,
    stage: "league",
    group_label: null,
    round: 1,
    position: number,
    number,
    participant_a_id: a,
    participant_b_id: b,
    status,
    winner_id: status === "completed" || status === "walkover" ? (winner ?? inferred) : null,
    games: scored,
  };
}

describe("computeStandings", () => {
  it("counts wins, games and points", () => {
    const table = computeStandings(
      ["x", "y"],
      [match("x", "y", [[21, 15], [18, 21], [21, 19]])],
      options,
    );
    expect(table[0]).toMatchObject({
      participantId: "x",
      position: 1,
      played: 1,
      won: 1,
      gamesWon: 2,
      gamesLost: 1,
      pointsFor: 60,
      pointsAgainst: 55,
      gameDifference: 1,
      pointDifference: 5,
      form: ["W"],
    });
    expect(table[1]).toMatchObject({ participantId: "y", lost: 1, form: ["L"] });
  });

  it("ignores matches that are not decided", () => {
    const table = computeStandings(
      ["x", "y"],
      [match("x", "y", [[21, 15], [10, 4]], "in_progress")],
      options,
    );
    expect(table.every((row) => row.played === 0)).toBe(true);
  });

  it("counts a walkover as a win without inventing points", () => {
    const table = computeStandings(["x", "y"], [match("x", "y", [], "walkover", "y")], options);
    expect(table[0]).toMatchObject({ participantId: "y", won: 1, pointsFor: 0, gamesWon: 0 });
  });

  it("separates level teams on game difference, then point difference", () => {
    // Three-way tie on one win each; game difference splits them.
    const table = computeStandings(
      ["x", "y", "z"],
      [
        match("x", "y", [[21, 10], [21, 10]]), // x 2-0
        match("y", "z", [[21, 10], [10, 21], [21, 19]]), // y 2-1
        match("z", "x", [[21, 19], [19, 21], [21, 17]]), // z 2-1
      ],
      options,
    );
    // Games: x 3-2 (+1), y 2-3 (-1), z 3-3 (0)
    expect(table.map((row) => row.participantId)).toEqual(["x", "z", "y"]);
  });

  it("decides on head-to-head when that is the next tiebreaker", () => {
    const table = computeStandings(
      ["a", "b", "c", "d"],
      [
        match("b", "a", [[21, 0], [21, 0]]),
        match("a", "c", [[21, 0], [21, 0]]),
        match("a", "d", [[21, 0], [21, 0]]),
        match("c", "b", [[21, 0], [21, 0]]),
        match("b", "d", [[21, 0], [21, 0]]),
        match("d", "c", [[21, 0], [21, 0]]),
      ],
      { ...options, tiebreakers: ["matches_won", "head_to_head"], nameOf: (id) => id },
    );
    // a and b both have two wins, b beat a; c and d one each, d beat c.
    expect(table.map((row) => row.participantId)).toEqual(["b", "a", "d", "c"]);
  });

  it("applies game difference before head-to-head, as badminton orders them", () => {
    // p and q both beat r 2-0 with identical scores and play each other.
    const table = computeStandings(
      ["p", "q", "r", "s"],
      [
        match("p", "r", [[21, 10], [21, 10]]),
        match("q", "r", [[21, 10], [21, 10]]),
        match("q", "p", [[21, 10], [10, 21], [21, 10]]),
        match("p", "s", [[21, 10], [21, 10]]),
        match("s", "q", [[21, 10], [10, 21], [21, 10]]),
        match("r", "s", [[21, 10], [21, 10]]),
      ],
      options,
    );
    // p: 2 wins, games 5-2; q: 2 wins, games 4-3 → p ahead on game difference.
    expect(table[0].participantId).toBe("p");
  });

  it("uses head-to-head among exactly the tied entries", () => {
    const tiebreakers = ["matches_won", "head_to_head"] as const;
    const table = computeStandings(
      ["a", "b", "c"],
      [
        match("a", "b", [[21, 0], [21, 0]]),
        match("b", "c", [[21, 0], [21, 0]]),
        match("c", "a", [[21, 0], [21, 0]]),
      ],
      { ...options, tiebreakers, nameOf: (id) => id },
    );
    // A perfect cycle: head-to-head cannot split it, so names decide.
    expect(table.map((row) => row.participantId)).toEqual(["a", "b", "c"]);
  });

  it("is deterministic when nothing has been played", () => {
    const table = computeStandings(["b", "a"], [], {
      ...options,
      seedOf: (id) => (id === "b" ? 1 : null),
    });
    expect(table.map((row) => row.participantId)).toEqual(["b", "a"]);
  });
});

describe("podium", () => {
  it("names nobody until a league is finished", () => {
    const played = [match("x", "y", [[21, 15], [21, 15]])];
    const unplayed = { ...match("x", "z", []), status: "scheduled" as const };
    const table = computeStandings(["x", "y", "z"], [...played, unplayed], options);
    expect(podium("round_robin", [...played, unplayed], table)).toBeNull();
    expect(podium("round_robin", played, table)?.champion).toBe("x");
  });

  it("reads the final and third-place playoff for a knockout", () => {
    const final: MatchRecord = {
      ...match("x", "y", [[21, 15], [21, 15]]),
      stage: "knockout",
      round: 2,
    };
    const third: MatchRecord = { ...match("z", "w", [[21, 15], [21, 15]]), stage: "third_place", round: 2 };
    const semi: MatchRecord = { ...match("x", "z", [[21, 15], [21, 15]]), stage: "knockout", round: 1 };
    expect(podium("knockout", [semi, final, third], null)).toEqual({
      champion: "x",
      runnerUp: "y",
      third: "z",
    });
  });
});
