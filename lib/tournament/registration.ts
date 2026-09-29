import type { TournamentStatus } from "./types";

/**
 * Whether the shared registration link is taking entries.
 *
 * This mirrors `private.registration_block_reason()` in the database, which is
 * the copy actually enforced — a captain can never register past it. This one
 * exists so the organizer's screens can explain the state without a round
 * trip. tests/db/registration.test.ts holds the two to the same answers.
 */

export type RegistrationBlock = "not_published" | "started" | "closed" | "deadline_passed" | "full";

/** Hard ceiling when the organizer sets no maximum. */
export const DEFAULT_MAX_ENTRIES = 256;

export function registrationBlockReason(
  tournament: {
    status: TournamentStatus;
    registration_open: boolean;
    registration_closes_at: string | null;
    max_participants: number | null;
  },
  liveEntries: number,
  now: Date = new Date(),
): RegistrationBlock | null {
  if (tournament.status === "draft") return "not_published";
  if (tournament.status !== "registration") return "started";
  if (!tournament.registration_open) return "closed";
  if (
    tournament.registration_closes_at !== null &&
    now.getTime() >= new Date(tournament.registration_closes_at).getTime()
  ) {
    return "deadline_passed";
  }
  if (liveEntries >= (tournament.max_participants ?? DEFAULT_MAX_ENTRIES)) return "full";
  return null;
}

/** For captains, on the registration page. */
export const REGISTRATION_BLOCK_COPY: Record<RegistrationBlock, { title: string; body: string }> = {
  not_published: {
    title: "Registration has not opened",
    body: "The organizer has not opened this tournament yet. Check back once they share it again.",
  },
  started: {
    title: "Registration is over",
    body: "The draw has been made and play has started, so no more entries can be taken.",
  },
  closed: {
    title: "Registration is closed",
    body: "The organizer has stopped taking entries for now.",
  },
  deadline_passed: {
    title: "The deadline has passed",
    body: "Entries closed at the deadline the organizer set.",
  },
  full: {
    title: "The draw is full",
    body: "Every slot has been taken. If an entry drops out, the organizer may reopen it.",
  },
};

/** For the organizer, on their dashboard. */
export const REGISTRATION_BLOCK_ORGANIZER_COPY: Record<RegistrationBlock, string> = {
  not_published: "Publish the tournament to start taking entries.",
  started: "Fixtures are out, so the link no longer accepts entries.",
  closed: "You have paused registration. The link shows a closed notice.",
  deadline_passed: "The registration deadline has passed.",
  full: "The draw is full. Raise the maximum or reject an entry to reopen a slot.",
};
