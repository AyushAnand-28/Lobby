import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { buildBadmintonSettings, ENTRY_TYPES } from "@/sports/badminton/rules";

/**
 * The `tournaments` row an organizer's create form produces, minus the slug.
 * Kept out of the Server Action so tests/db can insert exactly this row under
 * row level security and hold it to the table's constraints.
 */
export function buildTournamentRow(input: CreateTournamentInput) {
  const entry = ENTRY_TYPES[input.entryType];
  const isGroups = input.format === "groups_knockout";

  return {
    sport: "badminton",
    name: input.name,
    format: input.format,
    // A round robin has no bracket, so no third-place playoff.
    third_place_match: input.format !== "round_robin" && input.thirdPlaceMatch,
    // The CHECK constraint requires these null outside the groups format.
    group_count: isGroups ? (input.groupCount ?? null) : null,
    advance_per_group: isGroups ? (input.advancePerGroup ?? null) : null,
    roster_min: entry.rosterMin,
    roster_max: entry.rosterMax,
    settings: buildBadmintonSettings(input.entryType, input.scoringPreset),
    max_participants: input.maxParticipants ?? null,
    court_count: input.courtCount ?? null,
    venue: input.venue ?? null,
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    description: input.description ?? null,
  };
}

export type NewTournamentRow = ReturnType<typeof buildTournamentRow>;
