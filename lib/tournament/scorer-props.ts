import type { TournamentStatus } from "./types";
import {
  matchTitle,
  sideName,
  summarise,
  winnerSide,
  type ScorerMatch,
  type TournamentView,
} from "./view";

/**
 * Everything the scoring screen needs about one match, for the organizer's
 * and the scorer link's match pages alike. Null when the match is not in this
 * tournament.
 */
export function scorerMatchProps(
  view: TournamentView,
  tournament: { status: TournamentStatus },
  matchId: string,
): {
  heading: string;
  match: ScorerMatch;
  busyCourts: string[];
  canScore: boolean;
  blockedReason?: string;
} | null {
  const match = view.byId.get(matchId);
  if (!match) return null;

  const heading = `${match.number !== null ? `Match ${match.number} · ` : ""}${matchTitle(view, match)}`;
  const busyCourts = view.onCourt
    .filter((other) => other.id !== match.id)
    .map((other) => other.court!)
    .filter(Boolean);

  let blockedReason: string | undefined;
  if (match.status === "bye") {
    blockedReason = "This is a bye. The entry goes straight through, so there is nothing to score.";
  } else if (!match.participant_a_id || !match.participant_b_id) {
    const missing = [
      !match.participant_a_id ? sideName(view, match, "a") : null,
      !match.participant_b_id ? sideName(view, match, "b") : null,
    ].filter(Boolean);
    blockedReason = `Waiting for ${missing.join(" and ").toLowerCase()}.`;
  } else if (tournament.status !== "in_progress" && tournament.status !== "completed") {
    blockedReason = "The draw has been reset, so this match no longer exists.";
  }

  return {
    heading,
    match: { ...summarise(view, match), live: match.live, winner: winnerSide(match) },
    busyCourts,
    canScore: blockedReason === undefined,
    blockedReason,
  };
}
