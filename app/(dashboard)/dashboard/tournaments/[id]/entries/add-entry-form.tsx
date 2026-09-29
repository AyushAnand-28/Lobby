"use client";

import { useActionState } from "react";

import { Field, fieldError } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { addEntryAction } from "@/lib/tournament/entries-actions";

/**
 * Add an entry directly, already approved — for a walk-in, or a team that
 * sent its names by phone. Contact details are optional.
 */
export function AddEntryForm({
  tournamentId,
  entryNoun,
  rosterMin,
  rosterMax,
}: {
  tournamentId: string;
  entryNoun: string;
  rosterMin: number;
  rosterMax: number;
}) {
  const [state, submit] = useActionState(addEntryAction.bind(null, tournamentId), initialAuthFormState);
  // After a success the form resets for the next entry; only errors echo values.
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors;
  const solo = rosterMax === 1;

  return (
    <form action={submit} className="grid gap-5">
      <FormAlert state={state} />
      <Field
        id="add-name"
        name="name"
        label={solo ? "Player name" : `${entryNoun.charAt(0).toUpperCase()}${entryNoun.slice(1)} name`}
        required
        maxLength={80}
        autoComplete="off"
        defaultValue={values.name}
        error={fieldError(errors, "name")}
      />
      {solo ? null : (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2.5 text-sm font-light text-foreground/60 uppercase">Players</legend>
          {Array.from({ length: rosterMax }, (_, index) => (
            <Field
              key={index}
              id={`add-players-${index}`}
              name="players"
              label={`Player ${index + 1}${index >= rosterMin ? " (optional)" : ""}`}
              required={index < rosterMin}
              maxLength={80}
              autoComplete="off"
              defaultValue={values[`players.${index}`]}
            />
          ))}
          {fieldError(errors, "players") ? (
            <p className="text-sm font-medium text-destructive sm:col-span-2">{fieldError(errors, "players")}</p>
          ) : null}
        </fieldset>
      )}
      <Field
        id="add-club"
        name="club"
        label="Club or college"
        maxLength={120}
        hint="Optional."
        defaultValue={values.club}
        error={fieldError(errors, "club")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="add-captain"
          name="captainName"
          label="Contact name"
          maxLength={80}
          hint="Optional."
          defaultValue={values.captainName}
          error={fieldError(errors, "captainName")}
        />
        <Field
          id="add-phone"
          name="phone"
          label="Contact phone"
          type="tel"
          hint="Optional."
          defaultValue={values.phone}
          error={fieldError(errors, "phone")}
        />
      </div>
      <SubmitButton pendingLabel="Adding…">Add entry</SubmitButton>
    </form>
  );
}
