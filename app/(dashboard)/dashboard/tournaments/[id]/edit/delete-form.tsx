"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { deleteTournamentAction } from "@/lib/tournament/actions";

/** Delete the tournament and everything in it. Asks for a tick first. */
export function DeleteTournamentForm({ tournamentId, name }: { tournamentId: string; name: string }) {
  const [state, submit, pending] = useActionState(
    deleteTournamentAction.bind(null, tournamentId),
    initialAuthFormState,
  );
  const error = state.fieldErrors?.confirm?.[0] ?? (state.status === "error" ? state.message : null);

  return (
    <form action={submit} className="grid gap-4">
      <label className="flex cursor-pointer items-start gap-3 text-base font-light">
        <input type="checkbox" name="confirm" className="mt-1 size-4 accent-destructive" />
        <span>
          Delete <strong className="font-medium">{name}</strong>, its entries, matches and results.
          This can&apos;t be undone.
        </span>
      </label>
      <Button type="submit" variant="destructive" size="lg" className="justify-self-start px-5" disabled={pending}>
        {pending ? "Deleting…" : "Delete tournament"}
      </Button>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
