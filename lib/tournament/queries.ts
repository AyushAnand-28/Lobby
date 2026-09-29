import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ParticipantStatus, TournamentFormat, TournamentStatus } from "./types";
import {
  buildTournamentView,
  ENTRY_COLUMNS,
  MATCH_COLUMNS,
  type EntryRow,
  type MatchRow,
  type TournamentShape,
  type TournamentView,
} from "./view";

/**
 * Reads for the organizer's screens and the captain's registration page.
 *
 * Organizer reads always filter on `organizer_id`. Row level security alone is
 * not enough here: its SELECT policy also returns *other* organizers'
 * published tournaments, because the public page needs them.
 */

export type TournamentSummary = {
  id: string;
  name: string;
  sport: string;
  format: TournamentFormat;
  status: TournamentStatus;
  venue: string | null;
  starts_on: string | null;
  ends_on: string | null;
  settings: unknown;
  created_at: string;
};

export type TournamentDetail = TournamentSummary & {
  slug: string;
  description: string | null;
  third_place_match: boolean;
  group_count: number | null;
  advance_per_group: number | null;
  max_participants: number | null;
  registration_open: boolean;
  registration_closes_at: string | null;
  court_count: number | null;
  roster_min: number;
  roster_max: number;
};

export type EntryCounts = Record<ParticipantStatus, number>;

/** An entry as the organizer sees it, contact details included. */
export type OrganizerEntry = {
  id: string;
  name: string;
  club: string | null;
  players: string[];
  seed: number | null;
  status: ParticipantStatus;
  source: "organizer" | "registration";
  created_at: string;
  contact: {
    captain_name: string;
    phone: string | null;
    email: string | null;
    note: string | null;
  } | null;
};

/** Waiting entries first — they are the ones needing a decision. */
const STATUS_ORDER: Record<ParticipantStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  withdrawn: 3,
};

const SUMMARY_COLUMNS = "id, name, sport, format, status, venue, starts_on, ends_on, settings, created_at";

const DETAIL_COLUMNS =
  `${SUMMARY_COLUMNS}, slug, description, third_place_match, group_count, ` +
  "advance_per_group, max_participants, registration_open, registration_closes_at, court_count, " +
  "roster_min, roster_max";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listOrganizerTournaments(organizerId: string): Promise<TournamentSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(SUMMARY_COLUMNS)
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load tournaments: ${error.message}`);
  return data as TournamentSummary[];
}

/**
 * One of the organizer's own tournaments, with its active registration token
 * and its entries. Null when the id is malformed, does not exist, or belongs
 * to someone else — the page renders a 404 for all three.
 */
export const getOrganizerTournament = cache(async function getOrganizerTournament(
  organizerId: string,
  id: string,
): Promise<{
  tournament: TournamentDetail;
  token: string | null;
  entries: OrganizerEntry[];
  counts: EntryCounts;
} | null> {
  if (!UUID.test(id)) return null;

  const supabase = await createSupabaseServerClient();
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizerId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the tournament: ${error.message}`);
  if (!tournament) return null;

  // Contacts are fetched separately and joined here rather than embedded: the
  // composite foreign key makes PostgREST's embed shape (object or array)
  // depend on details of the constraint, and a join in code does not.
  const [tokenResult, entriesResult, contactsResult] = await Promise.all([
    supabase
      .from("registration_tokens")
      .select("token")
      .eq("tournament_id", id)
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("participants")
      .select("id, name, club, players, seed, status, source, created_at")
      .eq("tournament_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("participant_contacts")
      .select("participant_id, captain_name, phone, email, note")
      .eq("tournament_id", id),
  ]);

  if (tokenResult.error) throw new Error(`Could not load the link: ${tokenResult.error.message}`);
  if (entriesResult.error) {
    throw new Error(`Could not load entries: ${entriesResult.error.message}`);
  }
  if (contactsResult.error) {
    throw new Error(`Could not load entry contacts: ${contactsResult.error.message}`);
  }

  const contacts = new Map(
    contactsResult.data.map(({ participant_id, ...contact }) => [participant_id, contact]),
  );
  const entries: OrganizerEntry[] = (
    entriesResult.data as Omit<OrganizerEntry, "contact">[]
  )
    .map((entry) => ({ ...entry, contact: contacts.get(entry.id) ?? null }))
    .sort((x, y) => STATUS_ORDER[x.status] - STATUS_ORDER[y.status]);

  const counts: EntryCounts = { pending: 0, approved: 0, rejected: 0, withdrawn: 0 };
  for (const entry of entries) counts[entry.status] += 1;

  return {
    // supabase-js types a select string it can parse; a concatenated one
    // comes back as an error type, so this goes through `unknown`.
    tournament: tournament as unknown as TournamentDetail,
    token: (tokenResult.data as { token: string } | null)?.token ?? null,
    entries,
    counts,
  };
});

/** The rows behind a drawn tournament, as the caller's session may see them. */
export async function loadTournamentView(
  tournament: TournamentShape & { id: string },
): Promise<TournamentView> {
  const supabase = await createSupabaseServerClient();
  const [entriesResult, matchesResult] = await Promise.all([
    supabase
      .from("participants")
      .select(ENTRY_COLUMNS)
      .eq("tournament_id", tournament.id)
      .in("status", ["approved", "withdrawn"])
      .order("created_at", { ascending: true }),
    supabase.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournament.id),
  ]);

  if (entriesResult.error) throw new Error(`Could not load entries: ${entriesResult.error.message}`);
  if (matchesResult.error) throw new Error(`Could not load matches: ${matchesResult.error.message}`);

  return buildTournamentView(
    tournament,
    entriesResult.data as EntryRow[],
    matchesResult.data as unknown as MatchRow[],
  );
}

/** The organizer's active scorer link token, or null. */
export async function getScorerToken(tournamentId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scorer_tokens")
    .select("token")
    .eq("tournament_id", tournamentId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error(`Could not load the scorer link: ${error.message}`);
  return (data as { token: string } | null)?.token ?? null;
}

/** What `scorer_session()` returns for a live scorer link. */
export type ScorerSession = TournamentShape & {
  id: string;
  slug: string;
  name: string;
};

/** The tournament behind a scorer link. Null for a malformed, unknown or revoked token. */
export const getScorerSession = cache(async (token: string): Promise<ScorerSession | null> => {
  if (!TOKEN.test(token)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("scorer_session", { p_token: token });

  if (error) throw new Error(`Could not load the scorer link: ${error.message}`);
  if (!data) return null;
  // scorer_session() does not return advance_per_group; nothing on the
  // scorer's screens reads it.
  return { advance_per_group: null, ...(data as Omit<ScorerSession, "advance_per_group">) };
});

export type PublicTournament = TournamentShape & {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue: string | null;
  host_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  third_place_match: boolean;
  group_count: number | null;
  max_participants: number | null;
  completed_at: string | null;
};

const PUBLIC_COLUMNS =
  "id, slug, name, sport, settings, format, status, advance_per_group, court_count, description, " +
  "venue, host_name, starts_on, ends_on, third_place_match, group_count, max_participants, " +
  "completed_at";

/**
 * A published tournament by its public slug. Row level security hides drafts,
 * so a draft's slug reads exactly like one that does not exist.
 */
export const getPublicTournament = cache(async (slug: string): Promise<PublicTournament | null> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 96) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .neq("status", "draft")
    .maybeSingle();

  if (error) throw new Error(`Could not load the tournament: ${error.message}`);
  return (data as unknown as PublicTournament | null) ?? null;
});

/** What `registration_preview()` returns for a live link. */
export type RegistrationPreview = {
  accepting: boolean;
  reason: "open" | "not_published" | "started" | "closed" | "deadline_passed" | "full";
  live_entries: number;
  tournament: {
    id: string;
    slug: string;
    name: string;
    sport: string;
    format: TournamentFormat;
    description: string | null;
    venue: string | null;
    host_name: string | null;
    contact_phone: string | null;
    starts_on: string | null;
    ends_on: string | null;
    settings: unknown;
    roster_min: number;
    roster_max: number;
    max_participants: number | null;
    registration_closes_at: string | null;
  } | null;
};

const TOKEN = /^[0-9a-f]{24,64}$/;

/**
 * The registration page's view of a shared link. Null for a malformed, unknown
 * or revoked token. Cached per request so the page and its metadata share one
 * call.
 */
export const getRegistrationPreview = cache(
  async (token: string): Promise<RegistrationPreview | null> => {
    if (!TOKEN.test(token)) return null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("registration_preview", { p_token: token });

    if (error) throw new Error(`Could not load the registration link: ${error.message}`);
    return (data as RegistrationPreview | null) ?? null;
  },
);
