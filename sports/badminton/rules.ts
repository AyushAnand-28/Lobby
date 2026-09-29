import { z } from "zod";

/**
 * Badminton's rules as data: the sport's defaults, the scoring variants an
 * organizer can pick, and the kinds of entry a draw can take.
 *
 * `BADMINTON_SPORT_CONFIG` is the `sports.config` value seeded by the first
 * migration. Keep the two in step — tests/sports/badminton-rules.test.ts
 * compares them.
 */

export type BadmintonScoringRules = {
  /** Games in a match: 1, 3 or 5. */
  bestOf: 1 | 3 | 5;
  /** Points that win a game when not level near the end. */
  pointsToWin: number;
  /** Required margin. 2 in standard badminton; 1 for "first to N". */
  winBy: number;
  /** The side reaching this wins outright, whatever the margin. */
  hardCap: number | null;
};

export const STANDARD_SCORING: BadmintonScoringRules = {
  bestOf: 3,
  pointsToWin: 21,
  winBy: 2,
  hardCap: 30,
};

export const BADMINTON_SPORT_CONFIG = {
  participantType: "team",
  scoring: { unit: "game", ...STANDARD_SCORING },
  drawsAllowed: false,
  tiebreakers: ["matches_won", "game_difference", "point_difference", "head_to_head"],
} as const;

export type ScoringPresetId =
  | "standard"
  | "single-21"
  | "single-30"
  | "best-of-3-15"
  | "best-of-5-11";

/**
 * Formats local organizers actually run. Standard is BWF; the shorter ones are
 * what a one-day event with forty entries and three courts falls back on.
 */
export const SCORING_PRESETS: {
  id: ScoringPresetId;
  label: string;
  detail: string;
  rules: BadmintonScoringRules;
}[] = [
  {
    id: "standard",
    label: "Best of 3 to 21",
    detail: "BWF standard. Win by two, first to 30 at 29-all.",
    rules: STANDARD_SCORING,
  },
  {
    id: "single-21",
    label: "One game to 21",
    detail: "Win by two, capped at 30. Halves the time per match.",
    rules: { bestOf: 1, pointsToWin: 21, winBy: 2, hardCap: 30 },
  },
  {
    id: "single-30",
    label: "One game to 30",
    detail: "First to 30, no setting. Common for early rounds.",
    rules: { bestOf: 1, pointsToWin: 30, winBy: 1, hardCap: 30 },
  },
  {
    id: "best-of-3-15",
    label: "Best of 3 to 15",
    detail: "Win by two, capped at 21. A quicker full match.",
    rules: { bestOf: 3, pointsToWin: 15, winBy: 2, hardCap: 21 },
  },
  {
    id: "best-of-5-11",
    label: "Best of 5 to 11",
    detail: "The BWF trial format. Win by two, capped at 15.",
    rules: { bestOf: 5, pointsToWin: 11, winBy: 2, hardCap: 15 },
  },
];

export function scoringPreset(id: string | undefined): (typeof SCORING_PRESETS)[number] {
  return SCORING_PRESETS.find((preset) => preset.id === id) ?? SCORING_PRESETS[0];
}

export type EntryType = "singles" | "doubles" | "mixed";

/**
 * What one entry in the draw is. Roster sizes are written onto the tournament
 * row (`roster_min` / `roster_max`) so the registration function can enforce
 * them without knowing anything about badminton.
 *
 * Team ties — a club fielding several rubbers against another — are not
 * modelled yet: each fixture is one match.
 */
export const ENTRY_TYPES: Record<
  EntryType,
  { label: string; entryNoun: string; rosterMin: number; rosterMax: number }
> = {
  singles: { label: "Singles", entryNoun: "player", rosterMin: 1, rosterMax: 1 },
  doubles: { label: "Doubles", entryNoun: "pair", rosterMin: 2, rosterMax: 2 },
  mixed: { label: "Mixed doubles", entryNoun: "pair", rosterMin: 2, rosterMax: 2 },
};

export const ENTRY_TYPE_IDS = Object.keys(ENTRY_TYPES) as EntryType[];

/** The badminton part of `tournaments.settings`. */
export type BadmintonSettings = {
  entryType: EntryType;
  scoringPreset: ScoringPresetId;
  scoring: BadmintonScoringRules;
};

const scoringRulesSchema = z.object({
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  pointsToWin: z.number().int().min(5).max(50),
  winBy: z.number().int().min(1).max(3),
  hardCap: z.number().int().min(5).max(60).nullable(),
});

const settingsSchema = z.object({
  entryType: z.enum(["singles", "doubles", "mixed"]),
  scoringPreset: z.enum(["standard", "single-21", "single-30", "best-of-3-15", "best-of-5-11"]),
  scoring: scoringRulesSchema,
});

export const DEFAULT_BADMINTON_SETTINGS: BadmintonSettings = {
  entryType: "singles",
  scoringPreset: "standard",
  scoring: STANDARD_SCORING,
};

/**
 * Read settings from a tournament row. Never throws: a row written by an older
 * version of the app, or edited by hand, falls back field by field rather than
 * taking the tournament page down.
 */
export function parseBadmintonSettings(raw: unknown): BadmintonSettings {
  const parsed = settingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const partial = (raw ?? {}) as Partial<Record<keyof BadmintonSettings, unknown>>;
  const entryType = settingsSchema.shape.entryType.safeParse(partial.entryType);
  const preset = settingsSchema.shape.scoringPreset.safeParse(partial.scoringPreset);
  const scoring = scoringRulesSchema.safeParse(partial.scoring);

  return {
    entryType: entryType.success ? entryType.data : DEFAULT_BADMINTON_SETTINGS.entryType,
    scoringPreset: preset.success ? preset.data : DEFAULT_BADMINTON_SETTINGS.scoringPreset,
    scoring: scoring.success
      ? scoring.data
      : scoringPreset(preset.success ? preset.data : undefined).rules,
  };
}

/** Build the settings an organizer's choices imply. */
export function buildBadmintonSettings(
  entryType: EntryType,
  presetId: ScoringPresetId,
): BadmintonSettings {
  return { entryType, scoringPreset: presetId, scoring: scoringPreset(presetId).rules };
}
