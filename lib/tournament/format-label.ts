import { FORMATS, type TournamentFormat } from "./types";

/** "Groups, then knockout · 4 groups, top 2 go through · third-place match". */
export function formatLabel(tournament: {
  format: TournamentFormat;
  group_count: number | null;
  advance_per_group: number | null;
  third_place_match: boolean;
}): string {
  const parts: string[] = [FORMATS[tournament.format].label];
  if (tournament.format === "groups_knockout" && tournament.group_count) {
    parts.push(`${tournament.group_count} groups, top ${tournament.advance_per_group} go through`);
  }
  if (tournament.third_place_match) parts.push("third-place match");
  return parts.join(" · ");
}
