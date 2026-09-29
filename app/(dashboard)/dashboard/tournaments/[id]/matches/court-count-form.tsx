"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { setCourtCountAction } from "@/lib/tournament/actions";

/** How many courts the venue has. Inline, because it is set once on the day. */
export function CourtCountForm({
  tournamentId,
  courtCount,
}: {
  tournamentId: string;
  courtCount: number | null;
}) {
  const [state, submit, pending] = useActionState(
    setCourtCountAction.bind(null, tournamentId),
    initialAuthFormState,
  );
  const error = state.fieldErrors?.courtCount?.[0] ?? (state.status === "error" ? state.message : null);

  return (
    <form action={submit} className="grid gap-2">
      <label htmlFor="courtCount" className="text-sm font-light text-foreground/60 uppercase">
        Courts at the venue
      </label>
      <div className="flex gap-2">
        <input
          id="courtCount"
          name="courtCount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          required
          key={courtCount ?? "unset"}
          defaultValue={state.status === "error" ? state.values?.courtCount : (courtCount ?? "")}
          aria-invalid={error ? true : undefined}
          className="h-11 w-20 border border-border bg-transparent text-center text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" size="lg" className="h-11 px-4" disabled={pending}>
          {courtCount ? "Update" : "Set courts"}
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
