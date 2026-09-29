import type { SportTheme } from "../registry";

/**
 * Badminton — the first seeded sport.
 *
 * Court green, desaturated to sit alongside the indigo and orange of the brand
 * palette without fighting them. Scoring rules (best of 3 to 21, win by 2, hard
 * cap 30) belong in the `sports.config` column — this file is presentation only.
 */
export const badmintonTheme: SportTheme = {
  slug: "badminton",
  name: "Badminton",
  icon: "🏸",
  accent: {
    base: "#186b4e",
    foreground: "#ebebeb",
    soft: "#d7e6de",
  },
};
