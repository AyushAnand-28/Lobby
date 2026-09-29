"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AuthFormState } from "@/lib/auth/form-state";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTournamentSchema } from "@/lib/validation/tournament";
import { parseBadmintonSettings } from "@/sports/badminton/rules";
import {
  errorCode,
  invalidForm,
  readField,
  SESSION_EXPIRED,
  zodFieldErrors,
} from "./action-helpers";
import { describeTournamentError } from "./errors";
import { buildTournamentRow } from "./new-tournament";
import { tournamentSlug } from "./slug";

/**
 * Organizer actions on a tournament as a whole.
 *
 * Every action re-reads the user: a Server Action is a public POST endpoint,
 * reachable without ever rendering the page that uses it. Row level security
 * is the real boundary — an update to someone else's tournament matches no
 * rows — but failing early gives a clear message rather than a silent no-op.
 */

/** Attempts at a unique slug before giving up. Four random characters make a clash rare. */
const SLUG_ATTEMPTS = 3;

const FORM_FIELDS = [
  "name",
  "format",
  "entryType",
  "scoringPreset",
  "thirdPlaceMatch",
  "groupCount",
  "advancePerGroup",
  "maxParticipants",
  "courtCount",
  "venue",
  "startsOn",
  "endsOn",
  "description",
] as const;

function readTournamentForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(FORM_FIELDS.map((name) => [name, readField(formData, name)]));
}

function parseTournamentForm(values: Record<string, string>) {
  return createTournamentSchema.safeParse({
    ...values,
    thirdPlaceMatch: values.thirdPlaceMatch === "on",
  });
}

export async function createTournamentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = readTournamentForm(formData);

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SESSION_EXPIRED, values };

  const parsed = parseTournamentForm(values);
  if (!parsed.success) return invalidForm(zodFieldErrors(parsed.error), values);

  const row = buildTournamentRow(parsed.data);
  const supabase = await createSupabaseServerClient();
  let createdId: string | null = null;

  for (let attempt = 0; attempt < SLUG_ATTEMPTS && !createdId; attempt++) {
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ ...row, slug: tournamentSlug(row.name) })
      .select("id")
      .single();

    if (!error) {
      createdId = (data as { id: string }).id;
    } else if (error.code !== "23505") {
      // 23505 is a unique violation — only the slug can clash, so retry.
      console.error("createTournamentAction", error);
      return {
        status: "error",
        message: "The tournament could not be saved. Try again in a moment.",
        values,
      };
    }
  }

  if (!createdId) {
    return {
      status: "error",
      message: "The tournament could not be saved. Try again in a moment.",
      values,
    };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/tournaments/${createdId}`);
}

/**
 * Save the edit form. Once the draw is made, the fields that shape it —
 * format, event, scoring, groups — are kept as they are whatever the form
 * sends; the database would refuse the change anyway (`draw_locked`). The
 * event also locks once entries exist, because it fixes how many players an
 * entry has.
 */
export async function updateTournamentAction(
  tournamentId: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = readTournamentForm(formData);

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SESSION_EXPIRED, values };

  const parsed = parseTournamentForm(values);
  if (!parsed.success) return invalidForm(zodFieldErrors(parsed.error), values);

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("tournaments")
    .select("status, settings")
    .eq("id", tournamentId)
    .eq("organizer_id", user.id)
    .maybeSingle();
  if (!current) return { status: "error", message: describeTournamentError("not_found"), values };

  const { count: liveEntries } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .in("status", ["pending", "approved"]);

  const drawn = current.status === "in_progress" || current.status === "completed";
  const currentEntryType = parseBadmintonSettings(current.settings).entryType;
  if (!drawn && (liveEntries ?? 0) > 0 && parsed.data.entryType !== currentEntryType) {
    return invalidForm(
      { entryType: ["Entries are already in, so the event can't change. Reject them first."] },
      values,
    );
  }

  const row: Partial<ReturnType<typeof buildTournamentRow>> = buildTournamentRow(parsed.data);
  if (drawn) {
    delete row.format;
    delete row.third_place_match;
    delete row.group_count;
    delete row.advance_per_group;
    delete row.roster_min;
    delete row.roster_max;
    delete row.settings;
  }
  delete row.sport;

  const { error } = await supabase.from("tournaments").update(row).eq("id", tournamentId);
  if (error) {
    return { status: "error", message: describeTournamentError(errorCode(error)), values };
  }

  revalidateTournament();
  redirect(`/dashboard/tournaments/${tournamentId}`);
}

export async function deleteTournamentAction(
  tournamentId: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SESSION_EXPIRED };

  if (readField(formData, "confirm") !== "on") {
    return invalidForm({ confirm: ["Tick the box to confirm."] }, {});
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", tournamentId)
    .eq("organizer_id", user.id);

  if (error) {
    console.error("deleteTournamentAction", error);
    return { status: "error", message: "The tournament could not be deleted. Try again." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Draft to registration: the shared link starts taking entries. */
export async function publishTournamentAction(tournamentId: string): Promise<void> {
  const supabase = await authorisedClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status: "registration" })
    .eq("id", tournamentId)
    .eq("status", "draft");

  if (error) throw new Error(`Could not publish the tournament: ${error.message}`);
  revalidateTournament();
}

/** Pause or resume the shared link without unpublishing. */
export async function setRegistrationOpenAction(
  tournamentId: string,
  open: boolean,
): Promise<void> {
  const supabase = await authorisedClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ registration_open: open })
    .eq("id", tournamentId);

  if (error) throw new Error(`Could not update registration: ${error.message}`);
  revalidateTournament();
}

/** Revoke the shared link and issue a new one. The old URL stops working. */
export async function rotateRegistrationLinkAction(tournamentId: string): Promise<void> {
  const supabase = await authorisedClient();
  const { error } = await supabase.rpc("rotate_registration_token", {
    p_tournament_id: tournamentId,
  });

  if (error) throw new Error(`Could not replace the link: ${error.message}`);
  revalidateTournament();
}

/** Revoke the scorer link and issue a new one. Volunteers need the new URL. */
export async function rotateScorerLinkAction(tournamentId: string): Promise<void> {
  const supabase = await authorisedClient();
  const { error } = await supabase.rpc("rotate_scorer_token", { p_tournament_id: tournamentId });

  if (error) throw new Error(`Could not replace the scorer link: ${error.message}`);
  revalidateTournament();
}

/** How many courts the venue has. Matches are called to courts 1..n. */
export async function setCourtCountAction(
  tournamentId: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = readField(formData, "courtCount").trim();
  const values = { courtCount: raw };
  const courtCount = Number(raw);
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 40) {
    return invalidForm({ courtCount: ["Use between 1 and 40 courts."] }, values);
  }

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SESSION_EXPIRED, values };

  const supabase = await createSupabaseServerClient();
  // A court above the new count must be cleared first, or its match would sit
  // on a court that no longer exists.
  const { data: stranded } = await supabase
    .from("matches")
    .select("court")
    .eq("tournament_id", tournamentId)
    .not("court", "is", null);
  const highest = Math.max(0, ...(stranded ?? []).map((row) => Number(row.court)));
  if (highest > courtCount) {
    return invalidForm(
      { courtCount: [`Court ${highest} has a match on it. Take it off before removing the court.`] },
      values,
    );
  }

  const { error } = await supabase
    .from("tournaments")
    .update({ court_count: courtCount })
    .eq("id", tournamentId)
    .eq("organizer_id", user.id);

  if (error) return { status: "error", message: describeTournamentError(errorCode(error)), values };

  revalidateTournament();
  return { status: "success", message: `${courtCount} court${courtCount === 1 ? "" : "s"} set.` };
}

// --- helpers ---------------------------------------------------------------

async function authorisedClient() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return createSupabaseServerClient();
}

/** Every page of every tournament: cheap, since they all render on demand. */
function revalidateTournament() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tournaments/[id]", "layout");
}
