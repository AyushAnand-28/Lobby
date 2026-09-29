import { emptyMatch } from "./knockout";
import { PlanError, randomId, type IdFactory, type MatchStage, type PlannedMatch } from "./types";

/**
 * Round-robin scheduling by the circle method.
 *
 * Fix the first entry, rotate the rest one place per round. With an odd count
 * a phantom entry is added and whoever draws it sits the round out, so every
 * round is as full as it can be and nobody rests twice in a row.
 */
export function roundRobinRounds(ids: string[]): [string, string][][] {
  if (new Set(ids).size !== ids.length) {
    throw new PlanError("An entry appears in the draw twice.");
  }

  const circle: (string | null)[] = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const n = circle.length;
  const rounds: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = circle[i];
      const away = circle[n - 1 - i];
      if (home === null || away === null) continue;
      // The fixed entry would otherwise always be listed first; alternate it.
      pairs.push(i === 0 && round % 2 === 1 ? [away, home] : [home, away]);
    }
    rounds.push(pairs);

    // Keep circle[0] in place, move the last entry to position 1.
    const last = circle.pop() as string | null;
    circle.splice(1, 0, last);
  }

  return rounds;
}

/** Plan one league (or one group) as matches, round by round. */
export function planLeague(
  ids: string[],
  options: { stage: MatchStage; groupLabel?: string | null; idFactory?: IdFactory },
): PlannedMatch[] {
  if (ids.length < 2) {
    throw new PlanError(
      options.groupLabel
        ? `Group ${options.groupLabel} needs at least two entries.`
        : "A league needs at least two entries.",
    );
  }
  const idFactory = options.idFactory ?? randomId;

  return roundRobinRounds(ids).flatMap((pairs, roundIndex) =>
    pairs.map(([a, b], pairIndex) => ({
      ...emptyMatch(idFactory(), options.stage, roundIndex + 1, pairIndex + 1, options.groupLabel ?? null),
      participant_a_id: a,
      participant_b_id: b,
    })),
  );
}

/**
 * Hand out match numbers in order of play: round 1 of every group, then round
 * 2, and so on — so a venue running groups in parallel works down one list.
 */
export function numberInPlayOrder(matches: PlannedMatch[], startNumber = 1): PlannedMatch[] {
  const sorted = [...matches].sort(
    (x, y) =>
      x.round - y.round ||
      (x.group_label ?? "").localeCompare(y.group_label ?? "") ||
      x.position - y.position,
  );
  let number = startNumber;
  return sorted.map((match) => ({ ...match, number: match.status === "bye" ? null : number++ }));
}
