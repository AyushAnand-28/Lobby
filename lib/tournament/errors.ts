/**
 * Copy for the short codes the tournament functions raise (`court_busy`,
 * `downstream_started`, ...). The database stays terse and stable; this is
 * where it becomes something an organizer at a venue can act on.
 */
const MESSAGES: Record<string, string> = {
  not_found: "That could not be found. It may have been removed. Reload the page.",
  invalid_token: "This scorer link is no longer valid. Ask the organizer for the current one.",
  invalid_status: "That can't be done at this stage of the tournament.",

  // Draw
  invalid_plan: "The draw could not be made from these entries.",
  invalid_participant: "An entry in the draw is no longer approved. Reload and try again.",
  fixtures_locked: "A match has been played, so the draw can no longer be changed.",
  knockout_exists: "The knockout has already been drawn.",
  groups_incomplete: "Every group match needs a result before the knockout can be drawn.",
  invalid_format: "Only a groups-then-knockout tournament has a separate knockout draw.",
  invalid_scope: "That part of the draw can't be reset.",
  draw_locked:
    "The draw has been made, so the format, event and scoring can't change. Reset the draw first.",
  status_managed_by_fixtures: "The tournament's status follows its matches and can't be set by hand.",
  organizer_immutable: "A tournament can't be moved to another organizer.",

  // Results
  bye_match: "A bye is never played, so it has no result.",
  participants_pending: "Both sides of this match aren't known yet.",
  invalid_winner: "The winner must be one of the two sides.",
  invalid_games: "Check the game scores.",
  invalid_live: "The live score could not be saved. Reload and carry on.",
  group_stage_locked:
    "The knockout has been drawn from the group tables, so group results are final. Reset the knockout to change one.",
  downstream_started:
    "The winner's next match has already started, so this result can't change who went through.",

  // Courts
  courts_not_set: "Set how many courts you have first.",
  court_busy: "Another match is on that court. Finish it or take it off first.",
  invalid_court: "That court doesn't exist. Check the number of courts.",
  match_decided: "This match already has a result.",
};

export function describeTournamentError(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Try again in a moment.";
}
