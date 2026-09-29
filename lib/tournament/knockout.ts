import {
  PlanError,
  randomId,
  type IdFactory,
  type MatchStage,
  type PlannedMatch,
} from "./types";

/**
 * Single-elimination brackets.
 *
 * The bracket is always a power of two. Entries short of that get byes, and
 * the standard seeding order hands those byes to the top seeds and keeps seeds
 * 1 and 2 apart until the final.
 */

export function bracketSize(entries: number): number {
  let size = 2;
  while (size < entries) size *= 2;
  return size;
}

export function roundsFor(size: number): number {
  return Math.log2(size);
}

/**
 * Seed numbers in bracket-slot order, top to bottom.
 *
 *   4 → [1, 4, 2, 3]
 *   8 → [1, 8, 4, 5, 2, 7, 3, 6]
 *
 * Built by doubling: every seed `s` in a bracket of size n is paired with
 * `2n + 1 - s` when the bracket grows to 2n. Adjacent slots meet in round one,
 * and seed s always meets the weakest seed available to it.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  for (let n = 1; n < size; n *= 2) {
    order = order.flatMap((seed) => [seed, 2 * n + 1 - seed]);
  }
  return order;
}

/** Round in which bracket slots `i` and `j` (0-based) would first meet. */
export function meetingRound(i: number, j: number): number {
  return Math.floor(Math.log2(i ^ j)) + 1;
}

export type KnockoutOptions = {
  thirdPlace: boolean;
  /** First match number to hand out; lets a knockout follow a group stage. */
  startNumber?: number;
  idFactory?: IdFactory;
};

/**
 * Plan a full bracket for entries in seed order (index 0 is the top seed).
 *
 * Byes are emitted as real rows with status `bye` and their winner already
 * written into the next round, so the bracket renders complete from the start
 * and the database never has to special-case them.
 */
export function planKnockout(seeds: string[], options: KnockoutOptions): PlannedMatch[] {
  const idFactory = options.idFactory ?? randomId;

  if (seeds.length < 2) {
    throw new PlanError("A knockout needs at least two entries.");
  }
  if (new Set(seeds).size !== seeds.length) {
    throw new PlanError("An entry appears in the draw twice.");
  }

  const size = bracketSize(seeds.length);
  const rounds = roundsFor(size);
  const order = seedOrder(size);

  const grid: PlannedMatch[][] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    grid.push(
      Array.from({ length: count }, (_, index) =>
        emptyMatch(idFactory(), "knockout", round, index + 1),
      ),
    );
  }

  // Link each match to the one its winner plays next.
  for (let r = 0; r < rounds - 1; r++) {
    grid[r].forEach((match, index) => {
      const next = grid[r + 1][Math.floor(index / 2)];
      match.next_match_id = next.id;
      match.next_slot = index % 2 === 0 ? "a" : "b";
    });
  }

  // Fill round one. The first seed of every pair is always a real entry: the
  // bye seeds (above the entry count) only ever pair with the top seeds.
  grid[0].forEach((match, index) => {
    const a = seeds[order[2 * index] - 1] ?? null;
    const b = seeds[order[2 * index + 1] - 1] ?? null;
    match.participant_a_id = a;
    match.participant_b_id = b;

    if (b === null) {
      match.status = "bye";
      match.winner_id = a;
      const next = grid[1]?.[Math.floor(index / 2)];
      if (next) {
        if (match.next_slot === "a") next.participant_a_id = a;
        else next.participant_b_id = a;
      }
    }
  });

  // Losing semi-finalists play off for third. Needs real semi-finals, so at
  // least four entries — with three, one "semi-final" is a bye.
  let thirdPlace: PlannedMatch | null = null;
  if (options.thirdPlace && seeds.length >= 4) {
    thirdPlace = emptyMatch(idFactory(), "third_place", rounds, 1);
    const semis = grid[rounds - 2];
    semis[0].loser_next_match_id = thirdPlace.id;
    semis[0].loser_next_slot = "a";
    semis[1].loser_next_match_id = thirdPlace.id;
    semis[1].loser_next_slot = "b";
  }

  // Order of play: round by round, third place just before the final.
  let number = options.startNumber ?? 1;
  const ordered: PlannedMatch[] = [];
  for (const [r, matches] of grid.entries()) {
    if (r === rounds - 1 && thirdPlace) {
      thirdPlace.number = number++;
      ordered.push(thirdPlace);
    }
    for (const match of matches) {
      if (match.status !== "bye") match.number = number++;
      ordered.push(match);
    }
  }

  return ordered;
}

export function emptyMatch(
  id: string,
  stage: MatchStage,
  round: number,
  position: number,
  groupLabel: string | null = null,
): PlannedMatch {
  return {
    id,
    stage,
    group_label: groupLabel,
    round,
    position,
    number: null,
    participant_a_id: null,
    participant_b_id: null,
    status: "scheduled",
    winner_id: null,
    next_match_id: null,
    next_slot: null,
    loser_next_match_id: null,
    loser_next_slot: null,
  };
}
