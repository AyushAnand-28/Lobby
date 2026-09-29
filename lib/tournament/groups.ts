import { bracketSize, meetingRound, planKnockout, seedOrder } from "./knockout";
import { numberInPlayOrder, planLeague } from "./round-robin";
import { PlanError, randomId, type IdFactory, type PlannedMatch } from "./types";

/**
 * Groups, then knockout.
 *
 * Entries are dealt into groups in serpentine order (1→A, 2→B, …, then back
 * from the last group) so every group gets a comparable spread of seeds. Once
 * the groups are played, the top finishers are seeded into a knockout that
 * keeps entries from the same group apart for as long as the bracket allows.
 */

export const GROUP_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export function assignGroups(seeded: string[], groupCount: number): Map<string, string[]> {
  if (groupCount < 2 || groupCount > GROUP_LABELS.length) {
    throw new PlanError(`Use between 2 and ${GROUP_LABELS.length} groups.`);
  }
  const groups = new Map<string, string[]>(
    GROUP_LABELS.slice(0, groupCount).map((label) => [label, []]),
  );
  const labels = [...groups.keys()];

  seeded.forEach((id, index) => {
    const lap = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const label = labels[lap % 2 === 0 ? offset : groupCount - 1 - offset];
    groups.get(label)!.push(id);
  });

  return groups;
}

export function planGroupStage(
  seeded: string[],
  options: { groupCount: number; advancePerGroup: number; idFactory?: IdFactory },
): { matches: PlannedMatch[]; groups: { id: string; group_label: string }[] } {
  const { groupCount, advancePerGroup } = options;

  if (seeded.length < groupCount * 2) {
    throw new PlanError(
      `${groupCount} groups need at least ${groupCount * 2} entries, and you have ${seeded.length}.`,
    );
  }

  const groups = assignGroups(seeded, groupCount);
  const smallest = Math.min(...[...groups.values()].map((members) => members.length));
  if (advancePerGroup > smallest) {
    throw new PlanError(
      `The smallest group has ${smallest} entries, so at most ${smallest} can go through from each.`,
    );
  }
  if (advancePerGroup * groupCount < 2) {
    throw new PlanError("At least two entries must go through to the knockout.");
  }

  const matches = [...groups.entries()].flatMap(([label, members]) =>
    planLeague(members, { stage: "group", groupLabel: label, idFactory: options.idFactory }),
  );

  return {
    matches: numberInPlayOrder(matches),
    groups: [...groups.entries()].flatMap(([label, members]) =>
      members.map((id) => ({ id, group_label: label })),
    ),
  };
}

export type Qualifier = {
  participantId: string;
  group: string;
  /** Finishing position in the group, 1-based. */
  position: number;
};

/**
 * Order qualifiers into knockout seeds.
 *
 * Group winners take the top seeds in group order. Everyone below them is
 * then shuffled only among their own finishing tier (runners-up with
 * runners-up) to minimise same-group meetings, weighting early meetings far
 * more heavily than late ones: a round-one rematch is all but forbidden, a
 * rematch in the final costs almost nothing.
 */
export function seedQualifiers(qualifiers: Qualifier[]): string[] {
  const seeds = [...qualifiers].sort(
    (x, y) => x.position - y.position || x.group.localeCompare(y.group),
  );

  const size = bracketSize(seeds.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  // Bracket slot of each seed number.
  const slotOfSeed = new Map(order.map((seed, slot) => [seed, slot]));

  const cost = (list: Qualifier[]): number => {
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i].group !== list[j].group) continue;
        const round = meetingRound(slotOfSeed.get(i + 1)!, slotOfSeed.get(j + 1)!);
        total += round === 1 ? 1_000_000 : 2 ** (rounds - round);
      }
    }
    return total;
  };

  const tiers = new Map<number, number[]>();
  seeds.forEach((qualifier, index) => {
    if (qualifier.position === 1) return;
    tiers.set(qualifier.position, [...(tiers.get(qualifier.position) ?? []), index]);
  });

  let best = cost(seeds);
  let improved = true;
  while (improved && best > 0) {
    improved = false;
    for (const indices of tiers.values()) {
      for (let x = 0; x < indices.length; x++) {
        for (let y = x + 1; y < indices.length; y++) {
          swap(seeds, indices[x], indices[y]);
          const next = cost(seeds);
          if (next < best) {
            best = next;
            improved = true;
          } else {
            swap(seeds, indices[x], indices[y]);
          }
        }
      }
    }
  }

  return seeds.map((qualifier) => qualifier.participantId);
}

function swap<T>(list: T[], i: number, j: number): void {
  [list[i], list[j]] = [list[j], list[i]];
}

/** The knockout that follows a finished group stage. */
export function planKnockoutFromGroups(
  qualifiers: Qualifier[],
  options: { thirdPlace: boolean; startNumber: number; idFactory?: IdFactory },
): PlannedMatch[] {
  if (qualifiers.length < 2) {
    throw new PlanError("At least two entries must go through to the knockout.");
  }
  return planKnockout(seedQualifiers(qualifiers), {
    thirdPlace: options.thirdPlace,
    startNumber: options.startNumber,
    idFactory: options.idFactory ?? randomId,
  });
}
