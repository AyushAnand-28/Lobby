import type { MatchRecord, MatchStage } from "./types";

/**
 * Human names for rounds and matches. The bracket and the public page read
 * these; nothing stores them.
 */

export function knockoutRoundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round of ${2 ** (fromEnd + 1)}`;
}

export function knockoutRounds(matches: Pick<MatchRecord, "stage" | "round">[]): number {
  return matches
    .filter((match) => match.stage === "knockout")
    .reduce((max, match) => Math.max(max, match.round), 0);
}

export function stageName(stage: MatchStage, groupLabel: string | null): string {
  switch (stage) {
    case "league":
      return "League";
    case "group":
      return `Group ${groupLabel ?? ""}`.trim();
    case "knockout":
      return "Knockout";
    case "third_place":
      return "Third place";
  }
}

/** "Semi-final 2", "Group B · Round 3", "Round 4". */
export function matchLabel(
  match: Pick<MatchRecord, "stage" | "group_label" | "round" | "position">,
  totalKnockoutRounds: number,
): string {
  switch (match.stage) {
    case "league":
      return `Round ${match.round}`;
    case "group":
      return `Group ${match.group_label} · Round ${match.round}`;
    case "third_place":
      return "Third-place playoff";
    case "knockout": {
      const fromEnd = totalKnockoutRounds - match.round;
      if (fromEnd === 0) return "Final";
      if (fromEnd === 1) return `Semi-final ${match.position}`;
      if (fromEnd === 2) return `Quarter-final ${match.position}`;
      return `${knockoutRoundName(match.round, totalKnockoutRounds)} · Match ${match.position}`;
    }
  }
}
