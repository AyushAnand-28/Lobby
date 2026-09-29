/**
 * Photography for tournaments. Placeholders from Unsplash (see
 * public/images/CREDITS.md) standing in for pictures of an organizer's own
 * events. Swap the files, keep the names.
 */

export const TOURNAMENT_ART = {
  /** Wide, dark: a shuttle over the net. Organizer banner. */
  banner: "/images/tournament-banner.jpg",
  /** First frame of `tournamentLoop`, so the still and the clip match exactly. */
  hero: "/images/tournament-hero.jpg",
  tournamentLoop: "/video/tournament-loop.mp4",
  podium: "/images/podium-trophies.jpg",
  register: "/images/register-panel.jpg",
  dashboard: "/images/dashboard-hall.jpg",
  empty: "/images/empty-shuttle.jpg",
} as const;

const CARD_ART = [
  "/images/tournament-banner.jpg",
  "/images/card-court.jpg",
  "/images/card-shuttle.jpg",
] as const;

/**
 * A card image for a tournament, stable for its id, so a list of several
 * tournaments does not show the same photograph on every card.
 */
export function tournamentCardArt(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CARD_ART[hash % CARD_ART.length];
}
