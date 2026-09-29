"use server";

import { z } from "zod";

import type { AuthFormState } from "@/lib/auth/form-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registrationSchema } from "@/lib/validation/tournament";
import { getEntryKind } from "@/sports/registry";
import { getRegistrationPreview } from "./queries";
import { describeRegistrationError, REGISTRATION_BLOCK_COPY } from "./registration";

/**
 * A captain submits an entry from the shared registration link. No account:
 * the token is the only credential, and `submit_registration()` — a SECURITY
 * DEFINER function — is the only way an anonymous caller can write an entry.
 *
 * Roster size is read from the tournament here, never from the form, so a
 * tampered form cannot change how many players an entry needs.
 */
export async function submitRegistrationAction(
  token: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const players = formData
    .getAll("players")
    .map((value) => (typeof value === "string" ? value : ""));
  const values: Record<string, string> = {
    name: readField(formData, "name"),
    club: readField(formData, "club"),
    captainName: readField(formData, "captainName"),
    phone: readField(formData, "phone"),
    email: readField(formData, "email"),
  };
  players.forEach((player, index) => {
    values[`players.${index}`] = player;
  });

  const preview = await getRegistrationPreview(token);
  if (!preview?.tournament) {
    return {
      status: "error",
      message: "This link is no longer valid. Ask the organizer for the current one.",
      values,
    };
  }
  if (!preview.accepting && preview.reason !== "open") {
    return { status: "error", message: REGISTRATION_BLOCK_COPY[preview.reason].body, values };
  }

  const { roster_min: rosterMin, roster_max: rosterMax, sport, settings } = preview.tournament;
  const noun = getEntryKind(sport, settings).noun;

  const parsed = registrationSchema.safeParse({ ...values, players });
  if (!parsed.success) return invalid(z.flattenError(parsed.error).fieldErrors, values);

  const input = parsed.data;
  // A one-player entry is the player: the entry name is their name.
  const roster = rosterMax === 1 ? [input.name] : input.players.filter((name) => name.length > 0);

  if (roster.length < rosterMin || roster.length > rosterMax) {
    return invalid(
      {
        players: [
          rosterMin === rosterMax
            ? `Enter ${rosterMin} player names.`
            : `Enter between ${rosterMin} and ${rosterMax} player names.`,
        ],
      },
      values,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_registration", {
    p_token: token,
    p_name: input.name,
    p_players: roster,
    p_captain_name: input.captainName,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_club: input.club ?? null,
  });

  if (error) {
    const described = describeRegistrationError(error.message, noun);
    if (described.field) {
      return invalid({ [described.field]: [described.message] }, values);
    }
    return { status: "error", message: described.message, values };
  }

  return {
    status: "success",
    message: `${input.name} is entered. The organizer will confirm your place.`,
  };
}

function invalid(
  fieldErrors: Record<string, string[] | undefined>,
  values: Record<string, string>,
): AuthFormState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors,
    values,
  };
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
