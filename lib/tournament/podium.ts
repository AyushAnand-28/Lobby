import { knockoutRounds } from "./rounds";
import type { StandingRow } from "./standings";
import { isDecided, type MatchRecord, type TournamentFormat } from "./types";

/**
 * Who won. Read from the final (and third-place playoff) for knockout formats,
 * from the top of the table for a league — and only once it is settled, so a
 * leader with games still to play is never announced as champion.
 */

export type Podium = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

export function podium(
  format: TournamentFormat,
  matches: MatchRecord[],
  leagueTable: StandingRow[] | null,
): Podium | null {
  if (format === "round_robin") {
    const league = matches.filter((match) => match.stage === "league");
    if (!leagueTable || league.length === 0 || !league.every((match) => isDecided(match.status))) {
      return null;
    }
    return {
      champion: leagueTable[0]?.participantId ?? null,
      runnerUp: leagueTable[1]?.participantId ?? null,
      third: leagueTable[2]?.participantId ?? null,
    };
  }

  const rounds = knockoutRounds(matches);
  const final = matches.find((match) => match.stage === "knockout" && match.round === rounds);
  if (!final || !final.winner_id) return null;

  const thirdPlace = matches.find((match) => match.stage === "third_place");
  return {
    champion: final.winner_id,
    runnerUp:
      final.winner_id === final.participant_a_id ? final.participant_b_id : final.participant_a_id,
    third: thirdPlace?.winner_id ?? null,
  };
}
