import { describe, expect, it } from "vitest";

import {
  addRally,
  normaliseLive,
  parseLiveState,
  replay,
  startLive,
  undoRally,
  type LiveState,
} from "@/lib/scoring/rallies";
import { STANDARD_SCORING } from "@/sports/badminton/rules";
import { createBadmintonScoring } from "@/sports/badminton/scoring";

const standard = createBadmintonScoring(STANDARD_SCORING);
const shortGame = createBadmintonScoring({ bestOf: 3, pointsToWin: 5, winBy: 2, hardCap: 7 });

function live(first: "a" | "b", rallies: string): LiveState {
  return { v: 1, first, rallies };
}

describe("replay", () => {
  it("starts at 0-0 with the toss winner serving", () => {
    expect(replay(standard, startLive("b"))).toMatchObject({
      games: [],
      current: { a: 0, b: 0 },
      currentIndex: 0,
      server: "b",
      winner: null,
    });
  });

  it("gives the serve to whoever won the last rally", () => {
    const snapshot = replay(standard, live("a", "aab"));
    expect(snapshot.current).toEqual({ a: 2, b: 1 });
    expect(snapshot.games).toEqual([{ a: 2, b: 1 }]);
    expect(snapshot.server).toBe("b");
  });

  it("moves to the next game, with the game's winner serving first", () => {
    const snapshot = replay(shortGame, live("a", "bbbbb" + "a"));
    expect(snapshot.gamesWon).toEqual({ a: 0, b: 1 });
    expect(snapshot.games).toEqual([{ a: 0, b: 5 }, { a: 1, b: 0 }]);
    expect(snapshot.currentIndex).toBe(1);

    const between = replay(shortGame, live("a", "bbbbb"));
    expect(between.current).toEqual({ a: 0, b: 0 });
    expect(between.games).toEqual([{ a: 0, b: 5 }]);
    expect(between.server).toBe("b");
  });

  it("plays extra points past the target until the margin or the cap", () => {
    // 4-4, then a leads 5-4 (not enough), 6-4 wins.
    const snapshot = replay(shortGame, live("a", "abababab" + "aa"));
    expect(snapshot.games[0]).toEqual({ a: 6, b: 4 });
    expect(snapshot.gamesWon.a).toBe(1);

    // 6-6, then the cap at 7 decides it.
    const capped = replay(shortGame, live("a", "ab".repeat(6) + "b"));
    expect(capped.games[0]).toEqual({ a: 6, b: 7 });
    expect(capped.gamesWon.b).toBe(1);
  });

  it("decides the match and stops serving", () => {
    const snapshot = replay(shortGame, live("a", "aaaaa" + "aaaaa"));
    expect(snapshot.winner).toBe("a");
    expect(snapshot.server).toBeNull();
    expect(snapshot.games).toEqual([{ a: 5, b: 0 }, { a: 5, b: 0 }]);
    expect(snapshot.current).toEqual({ a: 5, b: 0 });
    // The engine agrees with the replayed score.
    expect(shortGame.check(snapshot.games, { final: true }).ok).toBe(true);
  });

  it("ignores rallies after the winning one", () => {
    const snapshot = replay(shortGame, live("a", "aaaaa" + "aaaaa" + "bbb"));
    expect(snapshot.counted).toBe(10);
    expect(snapshot.games).toEqual([{ a: 5, b: 0 }, { a: 5, b: 0 }]);
  });

  it("always produces games the engine accepts as a match in progress", () => {
    let state = startLive("a");
    for (let i = 0; i < 200; i++) {
      state = addRally(standard, state, (i * 7) % 3 === 0 ? "b" : "a");
      const snapshot = replay(standard, state);
      expect(standard.check(snapshot.games, { final: false }).ok).toBe(true);
    }
  });
});

describe("editing the log", () => {
  it("undoes the last rally, back across a game boundary", () => {
    const state = live("a", "bbbbb");
    const undone = undoRally(state);
    expect(replay(shortGame, undone).current).toEqual({ a: 0, b: 4 });
    expect(replay(shortGame, undone).gamesWon.b).toBe(0);
    expect(undoRally(startLive("a")).rallies).toBe("");
  });

  it("refuses rallies once the match is won", () => {
    const won = live("a", "aaaaaaaaaa");
    expect(addRally(shortGame, won, "b")).toBe(won);
  });

  it("trims a posted log that runs past the end", () => {
    expect(normaliseLive(shortGame, live("b", "aaaaaaaaaabb")).rallies).toBe("aaaaaaaaaa");
  });
});

describe("parseLiveState", () => {
  it("accepts a stored log", () => {
    expect(parseLiveState({ v: 1, first: "b", rallies: "abba" })).toEqual(live("b", "abba"));
  });

  it.each([
    null,
    "aab",
    { v: 2, first: "a", rallies: "" },
    { v: 1, first: "c", rallies: "" },
    { v: 1, first: "a", rallies: "abc" },
    { v: 1, first: "a", rallies: "a".repeat(601) },
  ])("rejects %p", (raw) => {
    expect(parseLiveState(raw)).toBeNull();
  });
});
