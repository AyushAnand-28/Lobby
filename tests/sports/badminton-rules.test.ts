import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BADMINTON_SPORT_CONFIG,
  DEFAULT_BADMINTON_SETTINGS,
  ENTRY_TYPES,
  buildBadmintonSettings,
  parseBadmintonSettings,
  scoringPreset,
} from "@/sports/badminton/rules";
import { SPORTS } from "@/sports/registry";

describe("badminton settings", () => {
  it("parses what it builds", () => {
    const settings = buildBadmintonSettings("doubles", "best-of-3-15");
    expect(parseBadmintonSettings(settings)).toEqual(settings);
  });

  it("falls back field by field instead of throwing", () => {
    expect(parseBadmintonSettings(null)).toEqual(DEFAULT_BADMINTON_SETTINGS);
    expect(parseBadmintonSettings({ entryType: "mixed", scoring: "garbage" })).toEqual({
      entryType: "mixed",
      scoringPreset: "standard",
      scoring: scoringPreset("standard").rules,
    });
    expect(parseBadmintonSettings({ scoringPreset: "single-21" }).scoring).toEqual(
      scoringPreset("single-21").rules,
    );
  });

  it("gives pairs a roster of exactly two", () => {
    expect(ENTRY_TYPES.doubles.rosterMin).toBe(2);
    expect(ENTRY_TYPES.mixed.rosterMax).toBe(2);
    expect(ENTRY_TYPES.singles.rosterMax).toBe(1);
  });
});

describe("badminton sport config", () => {
  /**
   * The database seeds `sports.config` from a literal in the first migration.
   * The app reads its own copy. They must not drift.
   */
  it("matches the value seeded by the migration", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260921120000_core_schema.sql"),
      "utf8",
    );
    const seeded = sql.match(/'badminton',\s*'Badminton',\s*true,\s*'(\{[\s\S]*?\})'::jsonb/);
    expect(seeded).not.toBeNull();
    expect(JSON.parse(seeded![1])).toEqual(BADMINTON_SPORT_CONFIG);
  });

  it("uses the configured tiebreak order in the registry", () => {
    expect(SPORTS.badminton.tiebreakers).toEqual(BADMINTON_SPORT_CONFIG.tiebreakers);
  });
});
