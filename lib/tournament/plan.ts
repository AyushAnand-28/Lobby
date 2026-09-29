import { GROUP_LABELS, planGroupStage, type Qualifier } from "./groups";
import { planKnockout } from "./knockout";
import { numberInPlayOrder, planLeague } from "./round-robin";
import type { StandingRow } from "./standings";
import {
  PlanError,
  randomId,
  type IdFactory,
  type PlannedMatch,
  type TournamentFormat,
} from "./types";

/**
 * One entry point for turning approved entries into a draw.
 */

export const MAX_LEAGUE_ENTRIES = 32;

export type DrawEntry = { id: string; seed: number | null };

/**
 * Seed order for the draw: seeded entries first by seed, then everyone else —
 * shuffled for a random draw, or in registration order.
 */
export function orderForDraw(
  entries: DrawEntry[],
  options: { shuffle: boolean; random?: () => number },
): string[] {
  const seeded = entries
    .filter((entry) => entry.seed !== null)
    .sort((x, y) => (x.seed as number) - (y.seed as number));
  const unseeded = entries.filter((entry) => entry.seed === null);

  if (options.shuffle) {
    const random = options.random ?? Math.random;
    for (let i = unseeded.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
    }
  }

  return [...seeded, ...unseeded].map((entry) => entry.id);
}

export type FixturePlan = {
  matches: PlannedMatch[];
  /** Group membership, for group formats. Sent alongside the matches. */
  groups: { id: string; group_label: string }[];
};

export function planFixtures(input: {
  format: TournamentFormat;
  seeded: string[];
  thirdPlace: boolean;
  groupCount: number | null;
  advancePerGroup: number | null;
  idFactory?: IdFactory;
}): FixturePlan {
  const idFactory = input.idFactory ?? randomId;

  switch (input.format) {
    case "knockout":
      return {
        matches: planKnockout(input.seeded, { thirdPlace: input.thirdPlace, idFactory }),
        groups: [],
      };

    case "round_robin":
      if (input.seeded.length > MAX_LEAGUE_ENTRIES) {
        throw new PlanError(
          `A round robin of ${input.seeded.length} is ${(input.seeded.length * (input.seeded.length - 1)) / 2} matches. ` +
            `Above ${MAX_LEAGUE_ENTRIES} entries, use groups then knockout.`,
        );
      }
      return {
        matches: numberInPlayOrder(planLeague(input.seeded, { stage: "league", idFactory })),
        groups: [],
      };

    case "groups_knockout":
      if (!input.groupCount || !input.advancePerGroup) {
        throw new PlanError("Set the number of groups and how many go through from each.");
      }
      return planGroupStage(input.seeded, {
        groupCount: input.groupCount,
        advancePerGroup: input.advancePerGroup,
        idFactory,
      });
  }
}

/** The top `advancePerGroup` of each finished group, ready for seeding. */
export function qualifiersFromStandings(
  standingsByGroup: Map<string, StandingRow[]>,
  advancePerGroup: number,
): Qualifier[] {
  return [...standingsByGroup.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .flatMap(([group, rows]) =>
      rows.slice(0, advancePerGroup).map((row) => ({
        participantId: row.participantId,
        group,
        position: row.position,
      })),
    );
}

/** How many entries a groups format can hold, for form hints. */
export function groupCapacityHint(entries: number, groupCount: number): string {
  if (groupCount < 2 || groupCount > GROUP_LABELS.length) return "";
  const base = Math.floor(entries / groupCount);
  const larger = entries % groupCount;
  if (base < 2) return `Needs at least ${groupCount * 2} entries.`;
  return larger === 0
    ? `${groupCount} groups of ${base}.`
    : `${larger} group${larger === 1 ? "" : "s"} of ${base + 1}, ${groupCount - larger} of ${base}.`;
}
