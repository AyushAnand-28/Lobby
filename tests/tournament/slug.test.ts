import { describe, expect, it } from "vitest";

import { randomSlugSuffix, slugifyName, tournamentSlug } from "@/lib/tournament/slug";

// The CHECK constraint on tournaments.slug.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("tournament slugs", () => {
  it.each([
    ["City Open 2026", "city-open-2026"],
    ["  St. Xavier's -- Inter-College  ", "st-xavier-s-inter-college"],
    ["Café Crème Cup", "cafe-creme-cup"],
    ["U-19 / U-17 Doubles!!", "u-19-u-17-doubles"],
  ])("slugifies %p", (name, expected) => {
    expect(slugifyName(name)).toBe(expected);
  });

  it("falls back when a name has no Latin letters or digits", () => {
    expect(slugifyName("बैडमिंटन प्रतियोगिता")).toBe("tournament");
    expect(slugifyName("!!!")).toBe("tournament");
  });

  it("keeps long names under the column limit without a trailing dash", () => {
    const slug = slugifyName(`${"a".repeat(59)} ${"b".repeat(40)}`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toMatch(SLUG_PATTERN);
  });

  it("always satisfies the database constraint", () => {
    for (const name of ["City Open", "!!!", "x".repeat(120), "A — B — C"]) {
      const slug = tournamentSlug(name);
      expect(slug).toMatch(SLUG_PATTERN);
      expect(slug.length).toBeLessThanOrEqual(96);
    }
  });

  it("appends a four-character suffix without look-alike characters", () => {
    expect(randomSlugSuffix(() => 0)).toBe("aaaa");
    expect(randomSlugSuffix(() => 0.9999)).toBe("9999");
    for (let i = 0; i < 50; i++) {
      expect(randomSlugSuffix()).toMatch(/^[a-km-np-z2-9]{4}$/);
    }
  });
});
