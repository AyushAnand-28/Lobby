import { describe, expect, it } from "vitest";

import { assignGroups, planGroupStage, seedQualifiers, type Qualifier } from "@/lib/tournament/groups";
import { meetingRound, seedOrder } from "@/lib/tournament/knockout";
import { groupCapacityHint, orderForDraw, planFixtures, qualifiersFromStandings } from "@/lib/tournament/plan";
import { planLeague, roundRobinRounds } from "@/lib/tournament/round-robin";
import { PlanError } from "@/lib/tournament/types";

function ids(n: number) {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

describe("round robin", () => {
  it.each([2, 3, 4, 5, 8, 11])("pairs every entry with every other exactly once (%i entries)", (n) => {
    const rounds = roundRobinRounds(ids(n));
    const seen = new Set<string>();
    for (const pairs of rounds) {
      for (const [a, b] of pairs) {
        const key = [a, b].sort().join("-");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
  });

  it("never schedules an entry twice in one round", () => {
    for (const pairs of roundRobinRounds(ids(9))) {
      const inRound = pairs.flat();
      expect(new Set(inRound).size).toBe(inRound.length);
    }
  });

  it("uses n-1 rounds for an even count and n for an odd one", () => {
    expect(roundRobinRounds(ids(6))).toHaveLength(5);
    expect(roundRobinRounds(ids(5))).toHaveLength(5);
  });

  it("numbers league matches in order of play", () => {
    const plan = planFixtures({
      format: "round_robin",
      seeded: ids(4),
      thirdPlace: false,
      groupCount: null,
      advancePerGroup: null,
    });
    expect(plan.matches.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(plan.matches.every((m) => m.stage === "league")).toBe(true);
  });

  it("refuses a league that is too big to play", () => {
    expect(() =>
      planFixtures({ format: "round_robin", seeded: ids(33), thirdPlace: false, groupCount: null, advancePerGroup: null }),
    ).toThrow(/groups then knockout/);
  });

  it("refuses a league of one", () => {
    expect(() => planLeague(ids(1), { stage: "league" })).toThrow(PlanError);
  });
});

describe("groups", () => {
  it("deals seeds into groups in serpentine order", () => {
    const groups = assignGroups(ids(8), 4);
    expect(groups.get("A")).toEqual(["p1", "p8"]);
    expect(groups.get("B")).toEqual(["p2", "p7"]);
    expect(groups.get("D")).toEqual(["p4", "p5"]);
  });

  it("keeps group sizes within one of each other", () => {
    const sizes = [...assignGroups(ids(11), 3).values()].map((g) => g.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("plans a round robin inside each group, interleaved by round", () => {
    const plan = planGroupStage(ids(8), { groupCount: 2, advancePerGroup: 2 });
    expect(plan.matches).toHaveLength(12);
    expect(plan.groups).toHaveLength(8);
    // Round 1 of both groups comes before round 2 of either.
    const firstRound2 = plan.matches.findIndex((m) => m.round === 2);
    expect(plan.matches.slice(0, firstRound2).every((m) => m.round === 1)).toBe(true);
    expect(plan.matches.map((m) => m.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("refuses too few entries for the groups asked for", () => {
    expect(() => planGroupStage(ids(5), { groupCount: 3, advancePerGroup: 1 })).toThrow(/at least 6/);
  });

  it("refuses to advance more than the smallest group holds", () => {
    expect(() => planGroupStage(ids(7), { groupCount: 2, advancePerGroup: 4 })).toThrow(/at most 3/);
  });

  it("describes group sizes for the form", () => {
    expect(groupCapacityHint(12, 4)).toBe("4 groups of 3.");
    expect(groupCapacityHint(10, 4)).toBe("2 groups of 3, 2 of 2.");
    expect(groupCapacityHint(5, 4)).toBe("Needs at least 8 entries.");
  });
});

describe("knockout seeding from groups", () => {
  function qualifiers(groups: string[], perGroup: number): Qualifier[] {
    return groups.flatMap((group) =>
      Array.from({ length: perGroup }, (_, i) => ({
        participantId: `${group}${i + 1}`,
        group,
        position: i + 1,
      })),
    );
  }

  function firstRoundClashes(seeds: string[]): number {
    const order = seedOrder(2 ** Math.ceil(Math.log2(seeds.length)));
    let clashes = 0;
    for (let i = 0; i < order.length; i += 2) {
      const a = seeds[order[i] - 1];
      const b = seeds[order[i + 1] - 1];
      if (a && b && a[0] === b[0]) clashes++;
    }
    return clashes;
  }

  it("puts group winners on the top seeds in group order", () => {
    const seeds = seedQualifiers(qualifiers(["A", "B", "C", "D"], 2));
    expect(seeds.slice(0, 4)).toEqual(["A1", "B1", "C1", "D1"]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("avoids same-group first-round matches with %i groups of two", (g) => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H"].slice(0, g);
    const seeds = seedQualifiers(qualifiers(groups, 2));
    expect(firstRoundClashes(seeds)).toBe(0);
  });

  it("sends a group's winner and runner-up to opposite halves when it can", () => {
    const seeds = seedQualifiers(qualifiers(["A", "B", "C", "D"], 2));
    const order = seedOrder(8);
    for (const group of ["A", "B", "C", "D"]) {
      const first = order.indexOf(seeds.indexOf(`${group}1`) + 1);
      const second = order.indexOf(seeds.indexOf(`${group}2`) + 1);
      expect(meetingRound(first, second)).toBe(3);
    }
  });

  it("takes the top of each group's table", () => {
    const table = (group: string) =>
      [1, 2, 3].map((position) => ({
        participantId: `${group}${position}`,
        position,
        played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0,
        pointsFor: 0, pointsAgainst: 0, gameDifference: 0, pointDifference: 0, form: [],
      }));
    const result = qualifiersFromStandings(new Map([["B", table("B")], ["A", table("A")]]), 2);
    expect(result.map((q) => q.participantId)).toEqual(["A1", "A2", "B1", "B2"]);
  });
});

describe("draw order", () => {
  const entries = [
    { id: "late-seed-2", seed: 2 },
    { id: "u1", seed: null },
    { id: "seed-1", seed: 1 },
    { id: "u2", seed: null },
    { id: "u3", seed: null },
  ];

  it("puts seeds first, then the rest in registration order", () => {
    expect(orderForDraw(entries, { shuffle: false })).toEqual(["seed-1", "late-seed-2", "u1", "u2", "u3"]);
  });

  it("shuffles only the unseeded entries", () => {
    const order = orderForDraw(entries, { shuffle: true, random: () => 0 });
    expect(order.slice(0, 2)).toEqual(["seed-1", "late-seed-2"]);
    expect(order.slice(2).sort()).toEqual(["u1", "u2", "u3"]);
  });
});
