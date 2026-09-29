"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { normaliseLive, parseLiveState, replay } from "@/lib/scoring/rallies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getScoringEngine } from "@/sports/registry";
import type { GameScore, Side } from "@/sports/types";
import { errorCode, SESSION_EXPIRED } from "./action-helpers";
import { describeTournamentError } from "./errors";
import { getScorerSession } from "./queries";

/**
 * Recording results and calling matches to courts — for the organizer, and
 * for volunteers holding the scorer link.
 *
 * Both run the same checks here and the same database core; they differ only
 * in how they are authorised. The organizer's session reaches the
 * `record_match_result` / `assign_court` functions, which check ownership.
 * A volunteer has no session, so the link's token goes to the `scorer_*`
 * functions, which check the token instead.
 *
 * The sport's rules are enforced here, before the database is asked: a
 * result has to be a legal score under the tournament's scoring, and the
 * winner is read from the score, never taken from the form.
 */

export type ScoringActor =
  | { kind: "organizer"; tournamentId: string }
  | { kind: "scorer"; token: string };

export type ResultPayload =
  /** A finished match, typed in game by game. */
  | { kind: "final"; games: GameScore[] }
  /** One side did not play or could not continue. Games played so far are kept. */
  | { kind: "walkover"; winner: Side; games: GameScore[] }
  /** A rally-by-rally update; `finish` confirms a decided match. */
  | { kind: "live"; live: unknown; finish: boolean }
  /** Back to unplayed. */
  | { kind: "clear" };

export type ScoringResult = { error?: string };

const gamesSchema = z
  .array(
    z.object({
      a: z.number().int().min(0).max(99),
      b: z.number().int().min(0).max(99),
    }),
  )
  .max(7);

type MatchContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  sport: string;
  settings: unknown;
  match: {
    id: string;
    status: string;
    participant_a_id: string | null;
    participant_b_id: string | null;
  };
  revalidate: () => void;
};

async function loadContext(
  actor: ScoringActor,
  matchId: string,
): Promise<MatchContext | { error: string }> {
  const supabase = await createSupabaseServerClient();
  let tournamentId: string;
  let sport: string;
  let settings: unknown;
  let revalidate: () => void;

  if (actor.kind === "organizer") {
    const user = await getCurrentUser();
    if (!user) return { error: SESSION_EXPIRED };
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, sport, settings, slug")
      .eq("id", actor.tournamentId)
      .eq("organizer_id", user.id)
      .maybeSingle();
    if (!tournament) return { error: describeTournamentError("not_found") };
    tournamentId = tournament.id;
    sport = tournament.sport;
    settings = tournament.settings;
    revalidate = () => {
      revalidatePath("/dashboard/tournaments/[id]", "layout");
      revalidatePath("/t/[slug]", "page");
    };
  } else {
    const session = await getScorerSession(actor.token);
    if (!session) return { error: describeTournamentError("invalid_token") };
    tournamentId = session.id;
    sport = session.sport;
    settings = session.settings;
    revalidate = () => {
      revalidatePath("/s/[token]", "layout");
      revalidatePath("/t/[slug]", "page");
    };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, participant_a_id, participant_b_id")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (!match) return { error: describeTournamentError("not_found") };

  return { supabase, sport, settings, match, revalidate };
}

export async function saveResultAction(
  actor: ScoringActor,
  matchId: string,
  payload: ResultPayload,
): Promise<ScoringResult> {
  const context = await loadContext(actor, matchId);
  if ("error" in context) return { error: context.error };
  const { match } = context;
  const engine = getScoringEngine(context.sport, context.settings);
  const sideId = (side: Side) => (side === "a" ? match.participant_a_id : match.participant_b_id);

  let status: "scheduled" | "in_progress" | "completed" | "walkover";
  let games: GameScore[] = [];
  let winner: string | null = null;
  let live: unknown = null;

  switch (payload.kind) {
    case "final": {
      const parsed = gamesSchema.safeParse(payload.games);
      if (!parsed.success) return { error: "Scores must be whole numbers from 0 to 99." };
      const check = engine.check(parsed.data, { final: true });
      if (!check.ok) return { error: check.message };
      status = "completed";
      games = parsed.data;
      winner = sideId(check.progress.winner!);
      break;
    }
    case "walkover": {
      const parsed = gamesSchema.safeParse(payload.games);
      if (!parsed.success) return { error: "Scores must be whole numbers from 0 to 99." };
      // A retirement mid-match keeps the games played; a no-show has none.
      const check = engine.check(parsed.data, { final: false });
      if (!check.ok) return { error: check.message };
      if (payload.winner !== "a" && payload.winner !== "b") return { error: "Choose who goes through." };
      status = "walkover";
      games = parsed.data;
      winner = sideId(payload.winner);
      break;
    }
    case "live": {
      if (match.status === "completed" || match.status === "walkover") {
        return { error: describeTournamentError("match_decided") };
      }
      const state = parseLiveState(payload.live);
      if (!state) return { error: describeTournamentError("invalid_live") };
      const trimmed = normaliseLive(engine, state);
      const snapshot = replay(engine, trimmed);
      if (payload.finish && !snapshot.winner) {
        return { error: "The match isn't won yet." };
      }
      status = payload.finish ? "completed" : "in_progress";
      games = snapshot.games;
      winner = payload.finish ? sideId(snapshot.winner!) : null;
      live = trimmed;
      break;
    }
    case "clear":
      status = "scheduled";
      break;
  }

  const args = {
    p_match_id: matchId,
    p_status: status,
    p_games: games,
    p_winner_id: winner,
    p_live: live,
  };
  const { error } =
    actor.kind === "organizer"
      ? await context.supabase.rpc("record_match_result", args)
      : await context.supabase.rpc("scorer_record_result", { p_token: actor.token, ...args });

  if (error) return { error: describeTournamentError(errorCode(error)) };

  // A rally does not need every screen re-rendered — the scorer's own screen
  // already shows it, and the public page hears it through realtime. Anything
  // that changes the draw does.
  if (payload.kind !== "live" || payload.finish) context.revalidate();
  return {};
}

/** Put a match on a court, move it, or take it off (`court` null). */
export async function assignCourtAction(
  actor: ScoringActor,
  matchId: string,
  court: string | null,
): Promise<ScoringResult> {
  const context = await loadContext(actor, matchId);
  if ("error" in context) return { error: context.error };

  const { error } =
    actor.kind === "organizer"
      ? await context.supabase.rpc("assign_court", { p_match_id: matchId, p_court: court })
      : await context.supabase.rpc("scorer_assign_court", {
          p_token: actor.token,
          p_match_id: matchId,
          p_court: court,
        });

  if (error) return { error: describeTournamentError(errorCode(error)) };
  context.revalidate();
  return {};
}
