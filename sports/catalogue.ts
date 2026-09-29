/**
 * The sport catalogue — what Lobby covers, publicly.
 *
 * Deliberately separate from `registry.ts`. The registry answers "can the app
 * run this sport right now", and its entries carry themes and component
 * overrides that real tournaments resolve through. This file answers "what do
 * we tell people we support", which is a broader and much cheaper claim.
 *
 * Keeping them apart means the landing page can advertise the roadmap without
 * `getSportTheme("cricket")` starting to return something that implies a
 * scoring engine exists. When a sport genuinely ships, it gets a theme file and
 * a registry entry, and its status here moves to "live".
 */

export type SportStatus = "live" | "planned";

export type CatalogueSport = {
  slug: string;
  name: string;
  /** Rendered next to the name. Emoji for now; an icon component later. */
  icon: string;
  status: SportStatus;
  /** How this sport is scored — one line, shown on the sport tile. */
  scoring: string;
  /** Photograph for the tile. Omitted sports render as a plain name. */
  image?: string;
};

/**
 * Ordered by how likely a local organizer is to run one, not alphabetically.
 *
 * Exactly six carry photography, because the landing page lays them out three
 * to a row and a seventh would leave a hole in the grid. Everything after them
 * is listed as a name.
 */
export const SPORT_CATALOGUE: CatalogueSport[] = [
  {
    slug: "badminton",
    name: "Badminton",
    icon: "🏸",
    status: "live",
    scoring: "Best of three to 21, win by two, hard cap at 30",
    image: "/images/sport-badminton.jpg",
  },
  {
    slug: "cricket",
    name: "Cricket",
    icon: "🏏",
    status: "planned",
    scoring: "Limited overs, runs and wickets, net run rate on the table",
    image: "/images/sport-cricket.jpg",
  },
  {
    slug: "football",
    name: "Football",
    icon: "⚽",
    status: "planned",
    scoring: "Ninety minutes, goal difference, three points a win",
    image: "/images/sport-football.jpg",
  },
  {
    slug: "basketball",
    name: "Basketball",
    icon: "🏀",
    status: "planned",
    scoring: "Four quarters, running score, overtime if level",
    image: "/images/sport-basketball.jpg",
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    icon: "🏐",
    status: "planned",
    scoring: "Best of five to 25, win by two, fifth set to 15",
    image: "/images/sport-volleyball.jpg",
  },
  {
    slug: "table-tennis",
    name: "Table tennis",
    icon: "🏓",
    status: "planned",
    scoring: "Best of five or seven to 11, win by two",
    image: "/images/sport-tabletennis.jpg",
  },
  {
    slug: "tennis",
    name: "Tennis",
    icon: "🎾",
    status: "planned",
    scoring: "Sets and games, tie-break at six all",
  },
  {
    slug: "kabaddi",
    name: "Kabaddi",
    icon: "🤼",
    status: "planned",
    scoring: "Two halves, raid and tackle points, all-out bonus",
  },
  {
    slug: "throwball",
    name: "Throwball",
    icon: "🥎",
    status: "planned",
    scoring: "Best of three to 25, win by two",
  },
  {
    slug: "hockey",
    name: "Hockey",
    icon: "🏑",
    status: "planned",
    scoring: "Four quarters, goal difference on the table",
  },
  {
    slug: "chess",
    name: "Chess",
    icon: "♟️",
    status: "planned",
    scoring: "Swiss rounds, one point a win, a half for a draw",
  },
  {
    slug: "carrom",
    name: "Carrom",
    icon: "🎯",
    status: "planned",
    scoring: "Boards to 25 points, queen must be covered",
  },
];

/** Sports with photography, for the landing page grid. */
export function featuredSports(): CatalogueSport[] {
  return SPORT_CATALOGUE.filter((sport) => sport.image);
}

/** Everything else — rendered as a plain list of names. */
export function unfeaturedSports(): CatalogueSport[] {
  return SPORT_CATALOGUE.filter((sport) => !sport.image);
}

export function liveSports(): CatalogueSport[] {
  return SPORT_CATALOGUE.filter((sport) => sport.status === "live");
}
