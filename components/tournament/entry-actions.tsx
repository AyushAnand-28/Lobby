"use client";

import { Loader2Icon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { updateEntryStatusAction, type EntryActionState } from "@/lib/tournament/entries-actions";
import type { ParticipantStatus } from "@/lib/tournament/types";

const INITIAL: EntryActionState = {};

/** The buttons each state offers, primary first. */
const MOVES: Record<ParticipantStatus, { status: ParticipantStatus; label: string }[]> = {
  pending: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [{ status: "pending", label: "Undo approval" }],
  rejected: [{ status: "pending", label: "Restore" }],
  withdrawn: [],
};

/**
 * Approve / reject controls for one entry. Each entry has its own form and
 * action state, so an error shows next to the entry it is about.
 */
export function EntryActions({
  tournamentId,
  participantId,
  status,
  entryName,
}: {
  tournamentId: string;
  participantId: string;
  status: ParticipantStatus;
  entryName: string;
}) {
  const [state, submit] = useActionState(updateEntryStatusAction, INITIAL);
  const moves = MOVES[status];
  if (moves.length === 0) return null;

  return (
    <form action={submit} className="grid justify-items-start gap-2 sm:justify-items-end">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="participantId" value={participantId} />
      <div className="flex flex-wrap gap-2">
        {moves.map((move, index) => (
          <MoveButton
            key={move.status}
            status={move.status}
            label={move.label}
            primary={index === 0 && status === "pending"}
            entryName={entryName}
          />
        ))}
      </div>
      {state.error ? (
        <p aria-live="polite" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function MoveButton({
  status,
  label,
  primary,
  entryName,
}: {
  status: ParticipantStatus;
  label: string;
  primary: boolean;
  entryName: string;
}) {
  const { pending, data } = useFormStatus();
  const busy = pending && data?.get("status") === status;

  return (
    <Button
      type="submit"
      name="status"
      value={status}
      variant={primary ? "brand" : "outline"}
      size="lg"
      disabled={pending}
      aria-label={`${label} ${entryName}`}
      className="px-4"
    >
      {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
