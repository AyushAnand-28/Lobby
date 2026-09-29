import { describe, expect, it } from "vitest";

import {
  bracketSize,
  meetingRound,
  planKnockout,
  seedOrder,
} from "@/lib/tournament/knockout";
import { knockoutRoundName, matchLabel } from "@/lib/tournament/rounds";
import { PlanError, type PlannedMatch } from "@/lib/tournament/types";

function ids(n: number) {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

function counter() {
  let n = 0;
  return () => `m${++n}`;
}

function byId(matches: PlannedMatch[]) {
  return new Map(matches.map((match) => [match.id, match]));
}

describe("seeding", () => {
  it("rounds the bracket up to a power of two", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(8)).toBe(8);
    expect(bracketSize(9)).toBe(16);
  });

  it("orders seeds the standard way", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("pairs every seed with its mirror in round one", () => {
    const order = seedOrder(32);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(33);
    }
  });

  it("keeps seeds 1 and 2 apart until the final", () => {
    const order = seedOrder(16);
    expect(meetingRound(order.indexOf(1), order.indexOf(2))).toBe(4);
  });
});

describe("planKnockout", () => {
  it("plans a full eight-entry bracket", () => {
    const matches = planKnockout(ids(8), { thirdPlace: false, idFactory: counter() });
    expect(matches).toHaveLength(7);
    expect(matches.filter((m) => m.status === "bye")).toHaveLength(0);
    expect(matches.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const first = matches.filter((m) => m.round === 1);
    expect(first.map((m) => [m.participant_a_id, m.participant_b_id])).toEqual([
      ["p1", "p8"],
      ["p4", "p5"],
      ["p2", "p7"],
      ["p3", "p6"],
    ]);
  });

  it("links every non-final match to exactly one slot of the next round", () => {
    const matches = planKnockout(ids(16), { thirdPlace: false, idFactory: counter() });
    const lookup = byId(matches);
    const filled = new Map<string, number>();

    for (const match of matches) {
      if (match.round === 4) {
        expect(match.next_match_id).toBeNull();
        continue;
      }
      const next = lookup.get(match.next_match_id!)!;
      expect(next.round).toBe(match.round + 1);
      const key = `${next.id}:${match.next_slot}`;
      filled.set(key, (filled.get(key) ?? 0) + 1);
    }
    expect([...filled.values()].every((count) => count === 1)).toBe(true);
    expect(filled.size).toBe(14);
  });

  it("gives byes to the top seeds and advances them immediately", () => {
    const matches = planKnockout(ids(6), { thirdPlace: false, idFactory: counter() });
    const byes = matches.filter((m) => m.status === "bye");

    expect(byes.map((m) => m.participant_a_id).sort()).toEqual(["p1", "p2"]);
    for (const bye of byes) {
      expect(bye.participant_b_id).toBeNull();
      expect(bye.winner_id).toBe(bye.participant_a_id);
      expect(bye.number).toBeNull();
      const next = byId(matches).get(bye.next_match_id!)!;
      const advanced = bye.next_slot === "a" ? next.participant_a_id : next.participant_b_id;
      expect(advanced).toBe(bye.participant_a_id);
    }
    // Byes are not played, so they take no match number.
    expect(matches.filter((m) => m.number !== null)).toHaveLength(5);
  });

  it("never pairs two byes", () => {
    for (let n = 2; n <= 64; n++) {
      const matches = planKnockout(ids(n), { thirdPlace: false, idFactory: counter() });
      for (const match of matches.filter((m) => m.round === 1)) {
        expect(match.participant_a_id).not.toBeNull();
      }
      expect(matches.filter((m) => m.status === "bye")).toHaveLength(bracketSize(n) - n);
    }
  });

  it("feeds both semi-final losers into a third-place playoff", () => {
    const matches = planKnockout(ids(8), { thirdPlace: true, idFactory: counter() });
    const third = matches.find((m) => m.stage === "third_place")!;
    const semis = matches.filter((m) => m.stage === "knockout" && m.round === 2);

    expect(semis.map((m) => [m.loser_next_match_id, m.loser_next_slot])).toEqual([
      [third.id, "a"],
      [third.id, "b"],
    ]);
    // Played just before the final.
    const final = matches.find((m) => m.stage === "knockout" && m.round === 3)!;
    expect(third.number).toBe(final.number! - 1);
  });

  it("skips the third-place playoff with fewer than four entries", () => {
    const matches = planKnockout(ids(3), { thirdPlace: true, idFactory: counter() });
    expect(matches.some((m) => m.stage === "third_place")).toBe(false);
  });

  it("handles the two-entry final on its own", () => {
    const matches = planKnockout(ids(2), { thirdPlace: true, idFactory: counter() });
    expect(matches).toHaveLength(1);
    expect(matches[0].next_match_id).toBeNull();
  });

  it("refuses too few or duplicate entries", () => {
    expect(() => planKnockout(ids(1), { thirdPlace: false })).toThrow(PlanError);
    expect(() => planKnockout(["p1", "p1"], { thirdPlace: false })).toThrow(PlanError);
  });

  it("can continue match numbering after a group stage", () => {
    const matches = planKnockout(ids(4), { thirdPlace: false, startNumber: 13, idFactory: counter() });
    expect(matches.map((m) => m.number)).toEqual([13, 14, 15]);
  });
});

describe("round names", () => {
  it("counts back from the final", () => {
    expect(knockoutRoundName(4, 4)).toBe("Final");
    expect(knockoutRoundName(3, 4)).toBe("Semi-finals");
    expect(knockoutRoundName(2, 4)).toBe("Quarter-finals");
    expect(knockoutRoundName(1, 4)).toBe("Round of 16");
    expect(knockoutRoundName(1, 6)).toBe("Round of 64");
  });

  it("labels individual matches", () => {
    expect(matchLabel({ stage: "knockout", group_label: null, round: 3, position: 1 }, 3)).toBe("Final");
    expect(matchLabel({ stage: "knockout", group_label: null, round: 2, position: 2 }, 3)).toBe("Semi-final 2");
    expect(matchLabel({ stage: "group", group_label: "B", round: 2, position: 1 }, 0)).toBe(
      "Group B · Round 2",
    );
  });
});
