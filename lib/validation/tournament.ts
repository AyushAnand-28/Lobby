import { z } from "zod";

import { phoneSchema } from "./auth";

/**
 * Tournament and registration input validation. Zod v4.
 *
 * Limits mirror the CHECK constraints in the core schema migration, so a form
 * error is shown here rather than surfacing as a database error. The database
 * stays the authority: it re-checks everything these schemas check.
 */

/** Empty string to undefined, so optional columns stay null. */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((value) => (value.length === 0 ? undefined : value));
}

/** `<input type="date">` posts `YYYY-MM-DD`, or an empty string when unset. */
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: "Enter a valid date.",
  })
  .transform((value) => (value === "" ? undefined : value));

/** A whole number from a text or number input, or undefined when left blank. */
function optionalWholeNumber(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : Number(value)))
    .pipe(
      z
        .number({ error: message })
        .int({ error: message })
        .min(min, { error: message })
        .max(max, { error: message })
        .optional(),
    );
}

export const createTournamentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, { error: "Use at least 3 characters." })
      .max(120, { error: "Use 120 characters or fewer." }),
    format: z.enum(["knockout", "round_robin", "groups_knockout"], {
      error: "Choose a format.",
    }),
    // Badminton is the only live sport, so these are its settings. When a
    // second sport ships, they move behind the sport registry.
    entryType: z.enum(["singles", "doubles", "mixed"], { error: "Choose an event." }),
    scoringPreset: z.enum(["standard", "single-21", "single-30", "best-of-3-15", "best-of-5-11"], {
      error: "Choose a scoring format.",
    }),
    thirdPlaceMatch: z.boolean(),
    groupCount: optionalWholeNumber(2, 8, "Use between 2 and 8 groups."),
    advancePerGroup: optionalWholeNumber(1, 4, "Between 1 and 4 can go through."),
    maxParticipants: optionalWholeNumber(2, 256, "Use a number between 2 and 256."),
    courtCount: optionalWholeNumber(1, 40, "Use between 1 and 40 courts."),
    venue: optionalText(160, "Use 160 characters or fewer."),
    startsOn: optionalDate,
    endsOn: optionalDate,
    description: optionalText(2000, "Use 2000 characters or fewer."),
  })
  .refine((data) => data.format !== "groups_knockout" || data.groupCount !== undefined, {
    error: "Set the number of groups.",
    path: ["groupCount"],
  })
  .refine((data) => data.format !== "groups_knockout" || data.advancePerGroup !== undefined, {
    error: "Set how many go through from each group.",
    path: ["advancePerGroup"],
  })
  .refine(
    (data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn,
    { error: "The last day cannot be before the first.", path: ["endsOn"] },
  );

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

const personName = z
  .string()
  .trim()
  .min(1, { error: "Enter a name." })
  .max(80, { error: "Use 80 characters or fewer." });

/**
 * A captain's entry from the shared link. Roster size depends on the
 * tournament, so it is checked against `rosterMin` / `rosterMax` in the
 * action; `submit_registration()` enforces it again in the database.
 */
export const registrationSchema = z.object({
  name: personName,
  players: z.array(z.string().trim().max(80, { error: "Use 80 characters or fewer." })),
  club: optionalText(120, "Use 120 characters or fewer."),
  captainName: personName,
  // Required, unlike an organizer's: it is how the organizer reaches the entry.
  phone: phoneSchema.refine((value) => value !== undefined, {
    error: "Enter a phone number the organizer can reach you on.",
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value.length === 0 ? undefined : value))
    .pipe(z.email({ error: "Enter a valid email address." }).optional()),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

/**
 * An entry the organizer adds themselves — a walk-in, or a team that sent
 * their names by phone. Contact details are optional here: the organizer
 * already knows who they are.
 */
export const organizerEntrySchema = z.object({
  name: personName,
  players: z.array(z.string().trim().max(80, { error: "Use 80 characters or fewer." })),
  club: optionalText(120, "Use 120 characters or fewer."),
  captainName: optionalText(80, "Use 80 characters or fewer."),
  phone: phoneSchema,
});

export type OrganizerEntryInput = z.infer<typeof organizerEntrySchema>;
