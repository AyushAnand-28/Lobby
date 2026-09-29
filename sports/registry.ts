import type { CSSProperties } from "react";

import { parseBadmintonSettings } from "./badminton/rules";
import { createBadmintonScoring } from "./badminton/scoring";
import { badmintonTheme } from "./badminton/theme";
import { createGenericScoring } from "./generic/scoring";
import type { ScoringEngine } from "./types";

/**
 * Sport registry.
 *
 * Adding a sport means adding a theme file and one line to `SPORTS` below.
 * Everything sport-facing resolves through here, so a sport that supplies only
 * a theme still renders a complete, working — if plain — interface.
 *
 * This module stays free of React components so that server code and tests
 * can import it cheaply. Sport-specific UI (the live score keeper) resolves
 * through `sports/components.tsx`, which has the same fallback rule.
 */

export type SportAccent = {
  /** Primary accent. Any CSS colour; oklch keeps it consistent with the theme. */
  base: string;
  /** Text/icon colour that sits on top of `base`. Must clear 4.5:1 contrast. */
  foreground: string;
  /** Tinted background for badges and empty states. */
  soft: string;
};

export type SportTheme = {
  slug: string;
  name: string;
  /** Rendered next to the sport name. Emoji for now; an icon component later. */
  icon: string;
  accent: SportAccent;
};

/** Order in which level teams in a league table are separated. */
export type Tiebreaker = "matches_won" | "game_difference" | "point_difference" | "head_to_head";

export type SportEntry = {
  theme: SportTheme;
  /** Scoring engine for a tournament, built from its stored `settings`. */
  scoring: (settings: unknown) => ScoringEngine;
  tiebreakers: readonly Tiebreaker[];
};

/**
 * Used when a tournament's sport is unknown or has no theme of its own.
 * Falls back to the brand palette, so an unthemed sport looks deliberate
 * rather than broken.
 */
export const DEFAULT_SPORT_THEME: SportTheme = {
  slug: "generic",
  name: "Tournament",
  icon: "🏆",
  accent: {
    base: "#192b88",
    foreground: "#ebebeb",
    soft: "#c7dad9",
  },
};

export const DEFAULT_TIEBREAKERS: readonly Tiebreaker[] = [
  "matches_won",
  "head_to_head",
  "game_difference",
  "point_difference",
];

const GENERIC_SPORT: SportEntry = {
  theme: DEFAULT_SPORT_THEME,
  scoring: (settings) => createGenericScoring(readBestOf(settings)),
  tiebreakers: DEFAULT_TIEBREAKERS,
};

export const SPORTS: Record<string, SportEntry> = {
  badminton: {
    theme: badmintonTheme,
    scoring: (settings) => createBadmintonScoring(parseBadmintonSettings(settings).scoring),
    // Matches the order seeded into sports.config for badminton.
    tiebreakers: ["matches_won", "game_difference", "point_difference", "head_to_head"],
  },
};

export function getSport(slug: string | null | undefined): SportEntry {
  if (!slug) return GENERIC_SPORT;
  return SPORTS[slug] ?? GENERIC_SPORT;
}

export function getSportTheme(slug: string | null | undefined): SportTheme {
  return getSport(slug).theme;
}

export function getScoringEngine(slug: string | null | undefined, settings: unknown): ScoringEngine {
  return getSport(slug).scoring(settings);
}

export function listSports(): SportTheme[] {
  return Object.values(SPORTS).map((entry) => entry.theme);
}

/**
 * CSS custom properties for a sport, to spread onto a wrapper element:
 *
 *   <div style={sportThemeVars(theme)}>...</div>
 *
 * Children then use `bg-sport-accent` / `text-sport-accent` and pick up the
 * right colour with no conditional logic and no hardcoded palette.
 */
export function sportThemeVars(theme: SportTheme): CSSProperties {
  return {
    "--sport-accent": theme.accent.base,
    "--sport-accent-foreground": theme.accent.foreground,
    "--sport-accent-soft": theme.accent.soft,
  } as CSSProperties;
}

function readBestOf(settings: unknown): number {
  const bestOf = (settings as { scoring?: { bestOf?: unknown } } | null)?.scoring?.bestOf;
  return typeof bestOf === "number" ? bestOf : 1;
}
