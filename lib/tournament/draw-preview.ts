import { bracketSize, roundsFor } from "./knockout";
import { groupCapacityHint, MAX_LEAGUE_ENTRIES } from "./plan";
import type { TournamentFormat } from "./types";

/**
 * What a draw of this many entries will look like, in plain words, before it
 * is made — so the organizer can see "8 entries, 3 rounds, no byes" or
 * "needs 8 entries" without trying it.
 */
export function describeDraw(input: {
  format: TournamentFormat;
  entries: number;
  groupCount: number | null;
  advancePerGroup: number | null;
  thirdPlace: boolean;
}): { lines: string[]; problem: string | null } {
  const { format, entries } = input;
  if (entries < 2) return { lines: [], problem: "Approve at least two entries to make a draw." };

  switch (format) {
    case "knockout": {
      const size = bracketSize(entries);
      const byes = size - entries;
      const matches = entries - 1 + (input.thirdPlace && entries >= 4 ? 1 : 0);
      return {
        lines: [
          `${roundsFor(size)} rounds, ${matches} matches${input.thirdPlace && entries >= 4 ? " including the third-place match" : ""}.`,
          byes === 0
            ? "No byes: the draw is full."
            : `${byes} bye${byes === 1 ? "" : "s"} in the first round, given to the top seeds.`,
        ],
        problem: null,
      };
    }
    case "round_robin": {
      if (entries > MAX_LEAGUE_ENTRIES) {
        return {
          lines: [],
          problem: `A round robin of ${entries} is too long. Above ${MAX_LEAGUE_ENTRIES} entries, use groups then knockout.`,
        };
      }
      const rounds = entries % 2 === 0 ? entries - 1 : entries;
      return {
        lines: [
          `Everyone plays everyone: ${(entries * (entries - 1)) / 2} matches over ${rounds} rounds.`,
          entries % 2 === 1 ? "With an odd number, one entry sits out each round." : "",
        ].filter(Boolean),
        problem: null,
      };
    }
    case "groups_knockout": {
      const groups = input.groupCount ?? 0;
      const advance = input.advancePerGroup ?? 0;
      if (entries < groups * 2) {
        return { lines: [], problem: `${groups} groups need at least ${groups * 2} entries.` };
      }
      const smallest = Math.floor(entries / groups);
      if (advance > smallest) {
        return {
          lines: [],
          problem: `The smallest group would have ${smallest}, so at most ${smallest} can go through from each. Change the groups on the Edit tab.`,
        };
      }
      const qualifiers = groups * advance;
      return {
        lines: [
          groupCapacityHint(entries, groups),
          `Top ${advance} of each group go through: a knockout of ${qualifiers}, drawn once the groups are played.`,
        ],
        problem: null,
      };
    }
  }
}
