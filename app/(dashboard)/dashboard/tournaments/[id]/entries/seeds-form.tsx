"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { saveSeedsAction } from "@/lib/tournament/entries-actions";

/**
 * Seed numbers for approved entries. Seeds are kept apart in a knockout and
 * spread across groups; leave the strongest few seeded and the rest blank.
 */
export function SeedsForm({
  tournamentId,
  entries,
}: {
  tournamentId: string;
  entries: { id: string; name: string; seed: number | null }[];
}) {
  const [state, submit] = useActionState(saveSeedsAction.bind(null, tournamentId), initialAuthFormState);
  const values = state.status === "error" ? (state.values ?? {}) : null;

  return (
    <form action={submit} className="grid gap-5">
      <FormAlert state={state} />
      <ul className="grid border-t border-border">
        {entries.map((entry) => {
          const name = `seed.${entry.id}`;
          const error = state.fieldErrors?.[name]?.[0];
          return (
            <li key={entry.id} className="grid gap-1 border-b border-border py-3">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={name} className="min-w-0 truncate text-base">
                  {entry.name}
                </label>
                <input
                  id={name}
                  name={name}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  placeholder="-"
                  // Keyed on the saved seed so a successful save shows the stored value.
                  key={`${entry.id}-${entry.seed ?? ""}`}
                  defaultValue={values ? values[name] : (entry.seed ?? "")}
                  aria-invalid={error ? true : undefined}
                  className="h-11 w-16 shrink-0 border border-border bg-transparent text-center text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            </li>
          );
        })}
      </ul>
      <SubmitButton pendingLabel="Saving…">Save seeds</SubmitButton>
    </form>
  );
}
