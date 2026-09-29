import { describe, expect, it } from "vitest";

import {
  SPORT_CATALOGUE,
  featuredSports,
  liveSports,
  unfeaturedSports,
} from "@/sports/catalogue";
import { SPORTS } from "@/sports/registry";

describe("sport catalogue", () => {
  it("has unique slugs", () => {
    const slugs = SPORT_CATALOGUE.map((sport) => sport.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("splits cleanly into featured and unfeatured", () => {
    expect(featuredSports().length + unfeaturedSports().length).toBe(
      SPORT_CATALOGUE.length,
    );
    expect(featuredSports().every((sport) => sport.image)).toBe(true);
    expect(unfeaturedSports().every((sport) => !sport.image)).toBe(true);
  });

  it("gives every sport a scoring line to show on its tile", () => {
    expect(SPORT_CATALOGUE.every((sport) => sport.scoring.length > 0)).toBe(true);
  });

  /**
   * The important one. "Live" is a public claim that the app can actually run
   * that sport, so it has to be backed by a registry entry — otherwise the
   * landing page advertises a scoring engine that resolves to the generic
   * fallback at runtime.
   */
  it("only marks a sport live when the registry can resolve it", () => {
    for (const sport of liveSports()) {
      expect(SPORTS[sport.slug]).toBeDefined();
    }
  });

  it("keeps at least one sport live", () => {
    expect(liveSports().length).toBeGreaterThan(0);
  });
});
