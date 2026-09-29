import { describe, expect, it } from "vitest";

import { planFixtures } from "@/lib/tournament/plan";
import type { PlannedMatch } from "@/lib/tournament/types";
import {
  buildTournamentView,
  courtBoard,
  formatGames,
  matchTitle,
  sideName,
  type EntryRow,
  type MatchRow,
  type TournamentShape,
} from "@/lib/tournament/view";

let nextId = 0;
const idFactory = () => `m${++nextId}`;

function entries(count: number): EntryRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    players: [`Player ${index + 1}`],
    club: null,
    seed: null,
    group_label: null,
    status: "approved",
  }));
}

function rows(planned: PlannedMatch[]): MatchRow[] {
  return planned.map((match) => ({
    ...match,
    tournament_id: "t1",
    games: [],
    court: null,
    live: null,
    started_at: null,
    completed_at: match.status === "bye" ? "2026-10-01T09:00:00Z" : null,
  }));
}

const KNOCKOUT: TournamentShape = {
  sport: "badminton",
  settings: { entryType: "singles", scoringPreset: "standard" },
  format: "knockout",
  status: "in_progress",
  advance_per_group: null,
  court_count: 2,
};

function decide(match: MatchRow, side: "a" | "b", completedAt: string): MatchRow {
  return {
    ...match,
    status: "completed",
    winner_id: side === "a" ? match.participant_a_id : match.participant_b_id,
    games: side === "a" ? [{ a: 21, b: 10 }, { a: 21, b: 12 }] : [{ a: 10, b: 21 }, { a: 12, b: 21 }],
    completed_at: completedAt,
  };
}

describe("a knockout view", () => {
  const players = entries(4);
  const plan = planFixtures({
    format: "knockout",
    seeded: players.map((player) => player.id),
    thirdPlace: true,
    groupCount: null,
    advancePerGroup: null,
    idFactory,
  });
  const matches = rows(plan.matches);

  it("names the rounds and the slots still to be filled", () => {
    const view = buildTournamentView(KNOCKOUT, players, matches);
    expect(view.knockout.map((round) => round.length)).toEqual([2, 1]);

    const [semi1] = view.knockout[0];
    const final = view.knockout[1][0];
    expect(matchTitle(view, semi1)).toBe("Semi-final 1");
    expect(matchTitle(view, final)).toBe("Final");
    expect(sideName(view, semi1, "a")).toBe("Player 1");
    expect(sideName(view, final, "a")).toBe(`Winner of match ${semi1.number}`);
    expect(sideName(view, view.thirdPlace!, "a")).toBe(`Loser of match ${semi1.number}`);
  });

  it("sorts matches into on court, up next, waiting and finished", () => {
    const [semi1, semi2] = matches.filter((m) => m.stage === "knockout" && m.round === 1);
    const played = matches.map((match) => {
      if (match.id === semi1.id) return decide(match, "a", "2026-10-01T10:00:00Z");
      if (match.id === semi2.id) return { ...match, court: "2" };
      return match;
    });
    const view = buildTournamentView(KNOCKOUT, players, played);

    expect(view.finished.map((m) => m.id)).toEqual([semi1.id]);
    expect(view.onCourt.map((m) => m.id)).toEqual([semi2.id]);
    expect(view.upNext).toEqual([]);
    expect(view.waiting).toHaveLength(2); // final and bronze, one side each still open
    expect(courtBoard(view, 2)).toEqual([
      { court: "1", match: null },
      { court: "2", match: view.byId.get(semi2.id) },
    ]);
    expect(view.podium).toBeNull();
  });

  it("gives a bye's slot straight to the entry that received it", () => {
    const three = entries(3);
    const withBye = rows(
      planFixtures({
        format: "knockout",
        seeded: three.map((player) => player.id),
        thirdPlace: false,
        groupCount: null,
        advancePerGroup: null,
        idFactory,
      }).matches,
    );
    const view = buildTournamentView(KNOCKOUT, three, withBye);
    const bye = view.matches.find((m) => m.status === "bye")!;
    expect(sideName(view, bye, bye.participant_a_id ? "b" : "a")).toBe("Bye");
    // Byes are never played, so they are neither finished nor waiting.
    expect(view.finished).toEqual([]);
    expect(view.waiting.some((m) => m.id === bye.id)).toBe(false);
  });
});

describe("a groups view", () => {
  const players = entries(8);
  const plan = planFixtures({
    format: "groups_knockout",
    seeded: players.map((player) => player.id),
    thirdPlace: false,
    groupCount: 2,
    advancePerGroup: 2,
    idFactory,
  });
  const labelled = players.map((player) => ({
    ...player,
    group_label: plan.groups.find((g) => g.id === player.id)!.group_label,
  }));
  const shape: TournamentShape = { ...KNOCKOUT, format: "groups_knockout", advance_per_group: 2 };

  it("builds a table per group and asks for the knockout once they are done", () => {
    const open = buildTournamentView(shape, labelled, rows(plan.matches));
    expect(open.groups.map((g) => [g.label, g.rows.length])).toEqual([
      ["A", 4],
      ["B", 4],
    ]);
    expect(open.needsKnockoutDraw).toBe(false);

    // Lower-numbered entry wins every match.
    const played = rows(plan.matches).map((match, index) =>
      decide(
        match,
        Number(match.participant_a_id!.slice(1)) < Number(match.participant_b_id!.slice(1)) ? "a" : "b",
        `2026-10-01T10:${String(index).padStart(2, "0")}:00Z`,
      ),
    );
    const done = buildTournamentView(shape, labelled, played);
    expect(done.groupStageComplete).toBe(true);
    expect(done.needsKnockoutDraw).toBe(true);
    expect(done.groups[0].rows[0]).toMatchObject({ participantId: "p1", won: 3 });
    // Most recent result first.
    expect(done.finished[0].completed_at! > done.finished[1].completed_at!).toBe(true);
  });
});

describe("formatGames", () => {
  it("lists games from the first side's view", () => {
    expect(formatGames([{ a: 21, b: 15 }, { a: 19, b: 21 }])).toBe("21-15, 19-21");
    expect(formatGames([])).toBe("");
  });
});
