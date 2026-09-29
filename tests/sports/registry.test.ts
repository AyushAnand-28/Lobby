import { describe, expect, it } from "vitest";

import {
  DEFAULT_SPORT_THEME,
  getEntryKind,
  getScoringEngine,
  getSport,
  getSportTheme,
  listSports,
  sportThemeVars,
} from "@/sports/registry";

describe("sport registry", () => {
  it("resolves the seeded sport", () => {
    expect(getSportTheme("badminton").name).toBe("Badminton");
  });

  it.each([undefined, null, "", "kabaddi"])(
    "falls back to the generic theme for %p",
    (slug) => {
      expect(getSportTheme(slug)).toBe(DEFAULT_SPORT_THEME);
    },
  );

  it("still gives an unknown sport a working scoring engine", () => {
    // The fallback path must not throw — a sport with no entry still has to
    // render and take results, just generically.
    const engine = getScoringEngine("kabaddi", null);
    expect(engine.check([{ a: 31, b: 24 }], { final: true }).ok).toBe(true);
    expect(engine.check([{ a: 12, b: 12 }], { final: true }).ok).toBe(false);
    expect(getSport("kabaddi").tiebreakers.length).toBeGreaterThan(0);
  });

  it("builds badminton's engine from tournament settings", () => {
    const engine = getScoringEngine("badminton", { scoringPreset: "single-21" });
    expect(engine.maxGames).toBe(1);
    expect(engine.check([{ a: 22, b: 20 }], { final: true }).ok).toBe(true);
  });

  it("describes a badminton entry from tournament settings", () => {
    expect(getEntryKind("badminton", { entryType: "singles" })).toEqual({
      label: "Singles",
      noun: "player",
    });
    expect(getEntryKind("badminton", { entryType: "mixed" })).toEqual({
      label: "Mixed doubles",
      noun: "pair",
    });
    // Unreadable settings fall back to badminton's default event.
    expect(getEntryKind("badminton", null).noun).toBe("player");
  });

  it("calls an unknown sport's entries teams", () => {
    expect(getEntryKind("kabaddi", null)).toEqual({ label: "Teams", noun: "team" });
  });

  it("lists every registered sport", () => {
    expect(listSports().map((theme) => theme.slug)).toEqual(["badminton"]);
  });
});

describe("sportThemeVars", () => {
  it("emits the three accent custom properties", () => {
    const vars = sportThemeVars(getSportTheme("badminton")) as Record<string, string>;

    expect(vars["--sport-accent"]).toBe("#186b4e");
    expect(vars["--sport-accent-foreground"]).toBeDefined();
    expect(vars["--sport-accent-soft"]).toBeDefined();
  });
});
