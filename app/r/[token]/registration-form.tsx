"use client";

import { CircleCheckIcon } from "lucide-react";
import { useActionState } from "react";

import { Field, fieldError } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { submitRegistrationAction } from "@/lib/tournament/registration-actions";

/**
 * The captain's entry form. Filled on a phone, usually straight from a
 * WhatsApp message, so it asks for as little as the organizer needs: a name
 * for the draw, the players, and a number to call.
 */
export function RegistrationForm({
  token,
  entryNoun,
  rosterMin,
  rosterMax,
}: {
  token: string;
  entryNoun: string;
  rosterMin: number;
  rosterMax: number;
}) {
  const [state, submit] = useActionState(
    submitRegistrationAction.bind(null, token),
    initialAuthFormState,
  );
  const values = state.values ?? {};
  const errors = state.fieldErrors;
  const solo = rosterMax === 1;

  if (state.status === "success") {
    return (
      <div aria-live="polite" className="grid gap-4 border border-border bg-mist p-[var(--x-double-default)]">
        <CircleCheckIcon aria-hidden className="size-8 text-foreground" />
        <h2 className="text-2xl font-medium">Entry received</h2>
        <p className="text-base leading-relaxed font-light text-foreground/70">{state.message}</p>
        <p className="text-sm font-light text-muted-foreground">
          You can close this page. To enter another {entryNoun}, reload it.
        </p>
      </div>
    );
  }

  return (
    <form action={submit} className="grid gap-6">
      <FormAlert state={state} />

      <Field
        name="name"
        label={solo ? "Player name" : `${capitalise(entryNoun)} name`}
        required
        maxLength={80}
        autoComplete={solo ? "name" : "off"}
        hint={solo ? "As it should appear in the draw." : `How your ${entryNoun} appears in the draw.`}
        defaultValue={values.name}
        error={fieldError(errors, "name")}
      />

      {solo ? null : (
        <fieldset className="grid gap-4">
          <legend className="mb-2.5 text-sm font-light text-foreground/60 uppercase">
            Players
          </legend>
          {Array.from({ length: rosterMax }, (_, index) => (
            <Field
              key={index}
              id={`players-${index}`}
              name="players"
              label={`Player ${index + 1}${index >= rosterMin ? " (optional)" : ""}`}
              required={index < rosterMin}
              maxLength={80}
              autoComplete="off"
              defaultValue={values[`players.${index}`]}
            />
          ))}
          {fieldError(errors, "players") ? (
            <p className="text-sm font-medium text-destructive">{fieldError(errors, "players")}</p>
          ) : null}
        </fieldset>
      )}

      <Field
        name="club"
        label="Club or college"
        maxLength={120}
        hint="Optional."
        defaultValue={values.club}
        error={fieldError(errors, "club")}
      />

      <div className="grid gap-6 border-t border-border pt-6">
        <p className="text-base font-light text-foreground/70">
          Who should the organizer contact about this entry?
        </p>
        <Field
          name="captainName"
          label="Your name"
          required
          maxLength={80}
          autoComplete="name"
          defaultValue={values.captainName}
          error={fieldError(errors, "captainName")}
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          required
          autoComplete="tel"
          hint="Only the organizer sees this."
          defaultValue={values.phone}
          error={fieldError(errors, "phone")}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          hint="Optional."
          defaultValue={values.email}
          error={fieldError(errors, "email")}
        />
      </div>

      <SubmitButton pendingLabel="Sending…">Enter</SubmitButton>
    </form>
  );
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
