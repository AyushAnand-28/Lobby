"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorCode, readField, SESSION_EXPIRED } from "./action-helpers";
import { describeTournamentError } from "./errors";
import { planKnockoutFromGroups } from "./groups";
import { orderForDraw, planFixtures, qualifiersFromStandings } from "./plan";
import { loadTournamentView } from "./queries";
import { PlanError, type TournamentFormat, type TournamentStatus } from "./types";

/**
 * Making and unmaking the draw. The app plans it — seeding, byes, groups — and
 * the database stores it in one transaction, refusing to touch a draw once a
 * match in it has been played.
 */

export type DrawState = { error?: string; message?: string };

type DrawTournament = {
  id: string;
  sport: string;
  settings: unknown;
  format: TournamentFormat;
  status: TournamentStatus;
  third_place_match: boolean;
  group_count: number | null;
  advance_per_group: number | null;
  court_count: number | null;
};

async function ownTournament(tournamentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: SESSION_EXPIRED } as const;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tournaments")
    .select(
      "id, sport, settings, format, status, third_place_match, group_count, advance_per_group, court_count",
    )
    .eq("id", tournamentId)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (!data) return { error: describeTournamentError("not_found") } as const;
  return { supabase, tournament: data as DrawTournament } as const;
}

/**
 * Draw the tournament from its approved entries. Also redraws: the database
 * replaces an existing draw as long as nothing in it has been played.
 */
export async function makeDrawAction(
  tournamentId: string,
  _prevState: DrawState,
  formData: FormData,
): Promise<DrawState> {
  const own = await ownTournament(tournamentId);
  if ("error" in own) return { error: own.error };
  const { supabase, tournament } = own;

  if (tournament.status === "draft") {
    return { error: "Publish the tournament and approve entries before making the draw." };
  }

  const { data: approved, error: entriesError } = await supabase
    .from("participants")
    .select("id, seed")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (entriesError) return { error: "The entries could not be loaded. Try again." };
  const entries = (approved ?? []) as { id: string; seed: number | null }[];
  if (entries.length < 2) return { error: "Approve at least two entries to make a draw." };

  const shuffle = readField(formData, "order") !== "registration";

  let plan;
  try {
    plan = planFixtures({
      format: tournament.format,
      seeded: orderForDraw(entries, { shuffle }),
      thirdPlace: tournament.third_place_match,
      groupCount: tournament.group_count,
      advancePerGroup: tournament.advance_per_group,
    });
  } catch (error) {
    if (error instanceof PlanError) return { error: error.message };
    throw error;
  }

  const { error } = await supabase.rpc("generate_fixtures", {
    p_tournament_id: tournamentId,
    p_matches: plan.matches,
    p_groups: plan.groups,
  });
  if (error) return { error: describeTournamentError(errorCode(error)) };

  revalidateDraw();
  return { message: "The draw is made. Registration is now closed." };
}

/** Throw the draw away and reopen the tournament for changes. */
export async function resetDrawAction(
  tournamentId: string,
): Promise<DrawState> {
  const own = await ownTournament(tournamentId);
  if ("error" in own) return { error: own.error };

  const { error } = await own.supabase.rpc("reset_fixtures", {
    p_tournament_id: tournamentId,
    p_scope: "all",
  });
  if (error) return { error: describeTournamentError(errorCode(error)) };

  revalidateDraw();
  return { message: "The draw is gone. Entries can change again; registration stays closed until you reopen it." };
}

/** Groups-then-knockout: seed the knockout from the final group tables. */
export async function drawKnockoutAction(
  tournamentId: string,
): Promise<DrawState> {
  const own = await ownTournament(tournamentId);
  if ("error" in own) return { error: own.error };
  const { supabase, tournament } = own;

  if (tournament.format !== "groups_knockout" || !tournament.advance_per_group) {
    return { error: describeTournamentError("invalid_format") };
  }

  const view = await loadTournamentView(tournament);
  if (!view.groupStageComplete) return { error: describeTournamentError("groups_incomplete") };

  const standings = new Map(view.groups.map((group) => [group.label!, group.rows]));
  const lastNumber = view.matches.reduce((max, match) => Math.max(max, match.number ?? 0), 0);

  let matches;
  try {
    matches = planKnockoutFromGroups(
      qualifiersFromStandings(standings, tournament.advance_per_group),
      { thirdPlace: tournament.third_place_match, startNumber: lastNumber + 1 },
    );
  } catch (error) {
    if (error instanceof PlanError) return { error: error.message };
    throw error;
  }

  const { error } = await supabase.rpc("add_knockout_stage", {
    p_tournament_id: tournamentId,
    p_matches: matches,
  });
  if (error) return { error: describeTournamentError(errorCode(error)) };

  revalidateDraw();
  return { message: "The knockout is drawn." };
}

/** Remove an unplayed knockout so the group tables can be corrected. */
export async function resetKnockoutAction(
  tournamentId: string,
): Promise<DrawState> {
  const own = await ownTournament(tournamentId);
  if ("error" in own) return { error: own.error };

  const { error } = await own.supabase.rpc("reset_fixtures", {
    p_tournament_id: tournamentId,
    p_scope: "knockout",
  });
  if (error) return { error: describeTournamentError(errorCode(error)) };

  revalidateDraw();
  return { message: "The knockout is removed. Group results can be corrected again." };
}

/** Every page of every tournament: cheap, since they all render on demand. */
function revalidateDraw() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tournaments/[id]", "layout");
}
