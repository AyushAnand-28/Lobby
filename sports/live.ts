import type { LiveSnapshot } from "@/lib/scoring/rallies";
import { parseBadmintonSettings } from "./badminton/rules";
import {
  gamePointFor,
  intervalPoint,
  isDecidingGame,
  matchPointFor,
  serviceCourt,
} from "./badminton/scoring";
import type { ScoringEngine, Side } from "./types";

/**
 * What the live scorer tells the umpire between rallies. Game and match point
 * follow from any scoring engine; service court and the interval are
 * badminton's, so a sport without an entry here still gets a working scorer —
 * just without those prompts.
 */
export type LiveHints = {
  gamePoint: Side | null;
  matchPoint: Side | null;
  /** The court the next serve is from. */
  serviceCourt: "right" | "left" | null;
  /** The leader has just reached the mid-game interval. */
  interval: boolean;
  /** Ends change now: the interval of the deciding game. */
  changeEnds: boolean;
};

export function liveHints(
  sport: string,
  settings: unknown,
  engine: ScoringEngine,
  snapshot: LiveSnapshot,
  previous: LiveSnapshot | null,
): LiveHints {
  const decided = snapshot.winner !== null;
  const matchPoint = decided ? null : matchPointFor(engine, snapshot.gamesWon, snapshot.current);
  const hints: LiveHints = {
    gamePoint: decided || matchPoint ? null : gamePointFor(engine, snapshot.current),
    matchPoint,
    serviceCourt: null,
    interval: false,
    changeEnds: false,
  };

  if (sport !== "badminton" || decided) return hints;

  const rules = parseBadmintonSettings(settings).scoring;
  const server = snapshot.server;
  if (server) hints.serviceCourt = serviceCourt(snapshot.current[server]);

  // Only on the rally that reached it, and only within the same game.
  const at = intervalPoint(rules);
  const before = previous && previous.currentIndex === snapshot.currentIndex ? previous.current : null;
  const leader = Math.max(snapshot.current.a, snapshot.current.b);
  if (before && Math.max(before.a, before.b) < at && leader === at) {
    hints.interval = rules.bestOf > 1 || rules.pointsToWin >= 15;
    hints.changeEnds = isDecidingGame(snapshot.currentIndex, rules);
  }

  return hints;
}
