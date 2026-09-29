"use server";

import { revalidatePath } from "next/cache";

import type { AuthFormState } from "@/lib/auth/form-state";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizerEntrySchema } from "@/lib/validation/tournament";
import {
  invalidForm,
  readAll,
  readField,
  SESSION_EXPIRED,
  zodFieldErrors,
} from "./action-helpers";
import type { ParticipantStatus } from "./types";

/**
 * The organizer's actions on entries: decide on what captains submitted, add
 * entries directly, and seed the draw. All of it is only open before the draw
 * is made — once fixtures exist an entry is part of the bracket.
 */

export type EntryActionState = { error?: string };

/**
 * The moves an organizer can make on an entry before play. `withdrawn` is for
 * an entry that drops out of a draw already made; nothing here moves an entry
 * into or out of it.
 */
const ENTRY_TRANSITIONS: Record<ParticipantStatus, readonly ParticipantStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["pending", "rejected"],
  rejected: ["pending"],
  withdrawn: [],
};

const DRAW_MADE = "The draw has been made, so entries can't change. Reset the draw first.";

const NAME_TAKEN =
  "Another waiting or approved entry already has this name. Add a club or initials to tell them apart.";

/**
 * The organizer's own tournament, if its entries may still change. Returns a
 * user-facing error otherwise.
 */
async function openTournament(tournamentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: SESSION_EXPIRED } as const;

  const supabase = await createSupabaseServerClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("status, roster_min, roster_max, max_participants")
    .eq("id", tournamentId)
    .eq("organizer_id", user.id)
    .maybeSingle();

  if (!tournament) return { error: "This tournament could not be found." } as const;
  if (tournament.status !== "draft" && tournament.status !== "registration") {
    return { error: DRAW_MADE } as const;
  }
  return {
    supabase,
    tournament: tournament as { roster_min: number; roster_max: number; max_participants: number | null },
  } as const;
}

/** Approve, reject, or move an entry back to waiting. */
export async function updateEntryStatusAction(
  _prevState: EntryActionState,
  formData: FormData,
): Promise<EntryActionState> {
  const tournamentId = readField(formData, "tournamentId");
  const participantId = readField(formData, "participantId");
  const next = readField(formData, "status") as ParticipantStatus;

  const open = await openTournament(tournamentId);
  if ("error" in open) return { error: open.error };
  const { supabase } = open;

  const { data: entry } = await supabase
    .from("participants")
    .select("status")
    .eq("id", participantId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (!entry) return { error: "That entry no longer exists." };
  const current = entry.status as ParticipantStatus;
  if (!ENTRY_TRANSITIONS[current].includes(next)) return { error: "That change is not possible." };

  const { error } = await supabase
    .from("participants")
    .update({ status: next, ...(next === "approved" ? {} : { seed: null }) })
    .eq("id", participantId)
    .eq("tournament_id", tournamentId)
    // Only if nobody changed it in another tab meanwhile.
    .eq("status", current);

  if (error) {
    // participants_live_name_unique: restoring an entry whose name another
    // live entry has since taken.
    if (error.code === "23505") return { error: NAME_TAKEN };
    console.error("updateEntryStatusAction", error);
    return { error: "The entry could not be updated. Try again." };
  }

  revalidateEntries();
  return {};
}

/** Add an entry directly, approved. For walk-ins and entries sent by phone. */
export async function addEntryAction(
  tournamentId: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const players = readAll(formData, "players");
  const values: Record<string, string> = {
    name: readField(formData, "name"),
    club: readField(formData, "club"),
    captainName: readField(formData, "captainName"),
    phone: readField(formData, "phone"),
  };
  players.forEach((player, index) => {
    values[`players.${index}`] = player;
  });

  const open = await openTournament(tournamentId);
  if ("error" in open) return { status: "error", message: open.error, values };
  const { supabase, tournament } = open;

  const parsed = organizerEntrySchema.safeParse({ ...values, players });
  if (!parsed.success) return invalidForm(zodFieldErrors(parsed.error), values);

  const input = parsed.data;
  const roster =
    tournament.roster_max === 1 ? [input.name] : input.players.filter((name) => name.length > 0);
  if (roster.length < tournament.roster_min || roster.length > tournament.roster_max) {
    return invalidForm(
      {
        players: [
          tournament.roster_min === tournament.roster_max
            ? `Enter ${tournament.roster_min} player names.`
            : `Enter between ${tournament.roster_min} and ${tournament.roster_max} player names.`,
        ],
      },
      values,
    );
  }
  if (input.phone && !input.captainName) {
    return invalidForm({ captainName: ["Add whose number this is."] }, values);
  }

  const { data: created, error } = await supabase
    .from("participants")
    .insert({
      tournament_id: tournamentId,
      name: input.name,
      club: input.club ?? null,
      players: roster,
      status: "approved",
      source: "organizer",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return invalidForm({ name: [NAME_TAKEN] }, values);
    console.error("addEntryAction", error);
    return { status: "error", message: "The entry could not be added. Try again.", values };
  }

  if (input.captainName) {
    const { error: contactError } = await supabase.from("participant_contacts").insert({
      participant_id: (created as { id: string }).id,
      tournament_id: tournamentId,
      captain_name: input.captainName,
      phone: input.phone ?? null,
    });
    if (contactError) console.error("addEntryAction contact", contactError);
  }

  revalidateEntries();
  return { status: "success", message: `${input.name} is in, approved.` };
}

/**
 * Seed the draw. Seeds are optional: seeded entries are kept apart in a
 * knockout and spread across groups; everyone else is drawn around them.
 */
export async function saveSeedsAction(
  tournamentId: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const open = await openTournament(tournamentId);
  if ("error" in open) return { status: "error", message: open.error };
  const { supabase } = open;

  const { data: approved } = await supabase
    .from("participants")
    .select("id, seed")
    .eq("tournament_id", tournamentId)
    .eq("status", "approved");

  const entries = (approved ?? []) as { id: string; seed: number | null }[];
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};
  const seeds = new Map<string, number | null>();
  const used = new Map<number, string>();

  for (const entry of entries) {
    const raw = readField(formData, `seed.${entry.id}`).trim();
    values[`seed.${entry.id}`] = raw;
    if (raw === "") {
      seeds.set(entry.id, null);
      continue;
    }
    const seed = Number(raw);
    if (!Number.isInteger(seed) || seed < 1 || seed > entries.length) {
      fieldErrors[`seed.${entry.id}`] = [`Use 1 to ${entries.length}.`];
      continue;
    }
    if (used.has(seed)) {
      fieldErrors[`seed.${entry.id}`] = [`Seed ${seed} is used twice.`];
      continue;
    }
    used.set(seed, entry.id);
    seeds.set(entry.id, seed);
  }

  if (Object.keys(fieldErrors).length > 0) return invalidForm(fieldErrors, values);

  const changed = entries.filter((entry) => (seeds.get(entry.id) ?? null) !== entry.seed);
  const results = await Promise.all(
    changed.map((entry) =>
      supabase
        .from("participants")
        .update({ seed: seeds.get(entry.id) ?? null })
        .eq("id", entry.id)
        .eq("tournament_id", tournamentId),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("saveSeedsAction", failed.error);
    return { status: "error", message: "The seeds could not be saved. Try again.", values };
  }

  revalidateEntries();
  return {
    status: "success",
    message: used.size === 0 ? "No seeds set. The draw will be unseeded." : `${used.size} seeded.`,
  };
}

/** Every page of every tournament: cheap, since they all render on demand. */
function revalidateEntries() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tournaments/[id]", "layout");
}
