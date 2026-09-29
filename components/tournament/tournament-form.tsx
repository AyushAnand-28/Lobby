"use client";

import { useActionState, useState } from "react";

import { Field, fieldError } from "@/components/auth/field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { ChoiceGroup } from "@/components/forms/choice-group";
import { initialAuthFormState, type AuthFormState } from "@/lib/auth/form-state";
import { FORMATS, type TournamentFormat } from "@/lib/tournament/types";
import { ENTRY_TYPE_IDS, ENTRY_TYPES, SCORING_PRESETS } from "@/sports/badminton/rules";

const FORMAT_CHOICES = (Object.keys(FORMATS) as TournamentFormat[]).map((value) => ({
  value,
  label: FORMATS[value].label,
  detail: FORMATS[value].detail,
}));

const ENTRY_CHOICES = ENTRY_TYPE_IDS.map((value) => ({
  value,
  label: ENTRY_TYPES[value].label,
  detail: `Each entry is one ${ENTRY_TYPES[value].entryNoun}.`,
}));

const SCORING_CHOICES = SCORING_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
  detail: preset.detail,
}));

/**
 * Create or edit a tournament. When editing after the draw, the fields that
 * shape it — event, scoring, format, groups — are shown but fixed.
 */
export function TournamentForm({
  action,
  initial = {},
  lockDraw = false,
  lockEvent = false,
  submitLabel,
  pendingLabel,
  footnote,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Current values, as the form posts them. */
  initial?: Record<string, string>;
  /** The draw is made: format, event and scoring can't change. */
  lockDraw?: boolean;
  /** Entries exist: the event fixes their roster, so it can't change. */
  lockEvent?: boolean;
  submitLabel: string;
  pendingLabel: string;
  footnote?: string;
}) {
  const [state, submit] = useActionState(action, initialAuthFormState);
  const values = state.values ?? initial;
  const errors = state.fieldErrors;

  // Controlled because the fields below it depend on it: groups need a group
  // count, and a round robin has no bracket to hold a third-place match.
  const [format, setFormat] = useState<TournamentFormat>(
    (values.format as TournamentFormat | undefined) ?? "knockout",
  );

  return (
    <form action={submit} className="grid gap-12">
      <FormAlert state={state} />

      <Section title="The basics">
        <Field
          name="name"
          label="Tournament name"
          required
          minLength={3}
          maxLength={120}
          placeholder="City Open 2026"
          defaultValue={values.name}
          error={fieldError(errors, "name")}
        />
        <Field
          name="venue"
          label="Venue"
          maxLength={160}
          placeholder="Hall, college or club"
          hint="Optional."
          defaultValue={values.venue}
          error={fieldError(errors, "venue")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="startsOn"
            label="First day"
            type="date"
            defaultValue={values.startsOn}
            error={fieldError(errors, "startsOn")}
          />
          <Field
            name="endsOn"
            label="Last day"
            type="date"
            hint="Leave blank for a one-day event."
            defaultValue={values.endsOn}
            error={fieldError(errors, "endsOn")}
          />
        </div>
        <Field
          name="courtCount"
          label="Courts"
          type="number"
          inputMode="numeric"
          min={1}
          max={40}
          hint="How many courts you are playing on. Optional now; needed to call matches to courts."
          defaultValue={values.courtCount}
          error={fieldError(errors, "courtCount")}
        />
      </Section>

      <Section title="The event">
        {lockDraw || lockEvent ? (
          <p className="text-sm font-light text-foreground/60">
            {lockDraw
              ? "The draw has been made, so the event, scoring and format are fixed. Reset the draw to change them."
              : "Entries are in, so the event is fixed."}
          </p>
        ) : null}
        <ChoiceGroup
          name="entryType"
          legend="Badminton event"
          choices={ENTRY_CHOICES}
          columns={3}
          defaultValue={values.entryType ?? "singles"}
          disabled={lockDraw || lockEvent}
          error={fieldError(errors, "entryType")}
        />
        <ChoiceGroup
          name="scoringPreset"
          legend="Scoring"
          choices={SCORING_CHOICES}
          columns={2}
          defaultValue={values.scoringPreset ?? "standard"}
          disabled={lockDraw}
          error={fieldError(errors, "scoringPreset")}
        />
      </Section>

      <Section title="The draw">
        <ChoiceGroup
          name="format"
          legend="Format"
          choices={FORMAT_CHOICES}
          value={format}
          onValueChange={setFormat}
          disabled={lockDraw}
          error={fieldError(errors, "format")}
        />

        {format === "groups_knockout" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="groupCount"
              label="Groups"
              type="number"
              inputMode="numeric"
              min={2}
              max={8}
              required
              readOnly={lockDraw}
              defaultValue={values.groupCount || "4"}
              hint="Between 2 and 8."
              error={fieldError(errors, "groupCount")}
            />
            <Field
              name="advancePerGroup"
              label="Go through from each group"
              type="number"
              inputMode="numeric"
              min={1}
              max={4}
              required
              readOnly={lockDraw}
              defaultValue={values.advancePerGroup || "2"}
              error={fieldError(errors, "advancePerGroup")}
            />
          </div>
        ) : null}

        <Field
          name="maxParticipants"
          label="Maximum entries"
          type="number"
          inputMode="numeric"
          min={2}
          max={256}
          hint="Optional. The link stops taking entries once this many are in."
          defaultValue={values.maxParticipants}
          error={fieldError(errors, "maxParticipants")}
        />

        {format !== "round_robin" ? (
          <label className="flex cursor-pointer items-start gap-3 text-base font-light">
            <input
              type="checkbox"
              name="thirdPlaceMatch"
              defaultChecked={values.thirdPlaceMatch === "on"}
              // Read-only once drawn: a disabled checkbox would not post at all.
              onClick={lockDraw ? (event) => event.preventDefault() : undefined}
              aria-readonly={lockDraw || undefined}
              className="mt-1 size-4 accent-foreground"
            />
            <span>
              Play a third-place match
              <span className="block text-sm text-muted-foreground">
                The two losing semi-finalists play for bronze.
              </span>
            </span>
          </label>
        ) : null}
      </Section>

      <Section title="For captains">
        <div className="grid gap-2.5">
          <label htmlFor="description" className="text-sm font-light text-foreground/60 uppercase">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={values.description}
            aria-invalid={fieldError(errors, "description") ? true : undefined}
            aria-describedby="description-hint"
            className="min-h-28 w-full rounded-none border border-border bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            placeholder="Entry fee, reporting time, what to bring."
          />
          <p id="description-hint" className="text-sm font-light text-muted-foreground">
            Optional. Shown on the registration page and the public page.
          </p>
          {fieldError(errors, "description") ? (
            <p className="text-sm font-medium text-destructive">
              {fieldError(errors, "description")}
            </p>
          ) : null}
        </div>
      </Section>

      <div className="grid gap-3 border-t border-border pt-8">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        {footnote ? <p className="text-sm font-light text-muted-foreground">{footnote}</p> : null}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6">
      <h2 className="text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}
