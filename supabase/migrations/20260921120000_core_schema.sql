-- =============================================================================
-- Lobby core schema
--
-- Organizers, sports, tournaments, entries, the shared registration link and
-- matches. Row level security and the functions that write across tables live
-- in the two migrations after this one; nothing here is reachable from the API
-- until those have run, because RLS is enabled below with no policies yet.
--
-- Conventions:
-- - Status-like columns are text + CHECK rather than Postgres enums, so adding
--   a value later is a one-line constraint swap instead of `ALTER TYPE`.
-- - Every function pins `search_path = ''` and schema-qualifies everything.
-- - `private` holds helpers that must not be exposed through the Data API.
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizers — one row per auth user. The only role that logs in.
-- -----------------------------------------------------------------------------

create table public.organizers (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  phone text check (char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function private.set_updated_at();

/*
 * Signup writes display_name and phone into user metadata (see
 * lib/auth/actions.ts). This copies them into a real, joinable row the moment
 * the auth user exists.
 */
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organizers (id, display_name, phone)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Organizer'
    ), 80),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 32)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Accounts created before this migration ran.
insert into public.organizers (id, display_name, phone)
select
  u.id,
  left(coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Organizer'
  ), 80),
  left(nullif(btrim(u.raw_user_meta_data ->> 'phone'), ''), 32)
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- sports — what a tournament can be played as. `config` holds the sport's
-- default rules; a tournament may override them in its own `settings`.
-- -----------------------------------------------------------------------------

create table public.sports (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  is_live boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now()
);

insert into public.sports (slug, name, is_live, config)
values (
  'badminton',
  'Badminton',
  true,
  '{
    "participantType": "team",
    "scoring": { "unit": "game", "bestOf": 3, "pointsToWin": 21, "winBy": 2, "hardCap": 30 },
    "drawsAllowed": false,
    "tiebreakers": ["matches_won", "game_difference", "point_difference", "head_to_head"]
  }'::jsonb
)
on conflict (slug) do update
  set name = excluded.name,
      is_live = excluded.is_live,
      config = excluded.config;

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid()
    references public.organizers (id) on delete cascade,
  sport text not null references public.sports (slug),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 96),
  name text not null check (char_length(name) between 3 and 120),
  description text check (char_length(description) <= 2000),
  venue text check (char_length(venue) <= 160),
  host_name text check (char_length(host_name) <= 120),
  contact_phone text check (char_length(contact_phone) <= 32),
  starts_on date,
  ends_on date,

  -- Draw shape. Sport-agnostic: the tournament engine reads these.
  format text not null
    check (format in ('knockout', 'round_robin', 'groups_knockout')),
  third_place_match boolean not null default false,
  group_count smallint check (group_count between 2 and 8),
  advance_per_group smallint check (advance_per_group between 1 and 4),
  roster_min smallint not null default 1 check (roster_min between 1 and 20),
  roster_max smallint not null default 1 check (roster_max between 1 and 20),

  -- Sport-specific rules (entry type, scoring). Parsed by the sport module.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),

  status text not null default 'draft'
    check (status in ('draft', 'registration', 'in_progress', 'completed')),
  registration_open boolean not null default true,
  registration_closes_at timestamptz,
  max_participants smallint check (max_participants between 2 and 256),
  is_listed boolean not null default true,

  published_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tournaments_dates_ordered
    check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint tournaments_roster_ordered
    check (roster_max >= roster_min),
  constraint tournaments_groups_configured
    check (
      (format = 'groups_knockout' and group_count is not null and advance_per_group is not null)
      or (format <> 'groups_knockout' and group_count is null and advance_per_group is null)
    )
);

create index tournaments_organizer_idx on public.tournaments (organizer_id, created_at desc);
create index tournaments_listing_idx on public.tournaments (sport, status) where is_listed;

create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- registration_tokens — ONE shared, reusable link per tournament.
--
-- Deliberately no captain identity and no `used_at`: the organizer drops the
-- link in a WhatsApp group and any captain may submit from it. "Regenerate"
-- revokes the old row and inserts a new one; at most one is active.
-- -----------------------------------------------------------------------------

create table public.registration_tokens (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  -- 122 bits from gen_random_uuid, dashes stripped to keep the URL short.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(token) >= 24),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index registration_tokens_one_active
  on public.registration_tokens (tournament_id)
  where revoked_at is null;

-- Every tournament is born with a link, so there is never a "create link" step.
create or replace function private.create_registration_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registration_tokens (tournament_id) values (new.id);
  return new;
end;
$$;

create trigger tournaments_create_registration_token
  after insert on public.tournaments
  for each row execute function private.create_registration_token();

-- -----------------------------------------------------------------------------
-- participants — an entry in the draw: a player, a pair or a team.
--
-- Everything on this row is safe to show publicly once approved. Contact
-- details live in participant_contacts, which only the organizer can read —
-- RLS is row-level, so the split has to be a table boundary.
-- -----------------------------------------------------------------------------

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  club text check (char_length(club) <= 120),
  players text[] not null default '{}'
    check (cardinality(players) <= 20),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  seed smallint check (seed between 1 and 256),
  group_label text check (group_label ~ '^[A-H]$'),
  source text not null default 'organizer'
    check (source in ('organizer', 'registration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Target for the composite foreign keys below, which pin a match's
  -- participants to the match's own tournament.
  unique (id, tournament_id)
);

create index participants_tournament_idx on public.participants (tournament_id, status);

-- Two live entries cannot share a name — the draw would be unreadable.
create unique index participants_live_name_unique
  on public.participants (tournament_id, lower(name))
  where status in ('pending', 'approved');

create trigger participants_set_updated_at
  before update on public.participants
  for each row execute function private.set_updated_at();

create table public.participant_contacts (
  participant_id uuid primary key,
  tournament_id uuid not null,
  captain_name text not null check (char_length(captain_name) between 1 and 80),
  phone text check (char_length(phone) <= 32),
  email text check (char_length(email) <= 254),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (participant_id, tournament_id)
    references public.participants (id, tournament_id) on delete cascade
);

create index participant_contacts_tournament_idx on public.participant_contacts (tournament_id);

create trigger participant_contacts_set_updated_at
  before update on public.participant_contacts
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- matches
--
-- A bracket is a linked structure: each knockout match names the match its
-- winner moves to (`next_match_id` / `next_slot`) and, for semi-finals feeding
-- a third-place playoff, where its loser goes. Fixture generation computes the
-- whole graph up front with client-generated ids and inserts it in one
-- statement.
--
-- `games` is the per-game score, `[{"a": 21, "b": 17}, ...]`. The sport module
-- validates it; the database only guarantees shape.
-- -----------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage text not null check (stage in ('league', 'group', 'knockout', 'third_place')),
  group_label text check (group_label ~ '^[A-H]$'),
  round smallint not null check (round >= 1),
  position smallint not null check (position >= 1),
  -- Order of play across the whole tournament: "Match 14 on court 2".
  -- Null for byes, which are never played.
  number smallint check (number >= 1),
  participant_a_id uuid,
  participant_b_id uuid,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'walkover', 'bye')),
  winner_id uuid,
  games jsonb not null default '[]'::jsonb
    check (jsonb_typeof(games) = 'array' and jsonb_array_length(games) <= 7),
  court text check (char_length(court) <= 40),
  scheduled_at timestamptz,
  next_match_id uuid references public.matches (id) on delete set null,
  next_slot text check (next_slot in ('a', 'b')),
  loser_next_match_id uuid references public.matches (id) on delete set null,
  loser_next_slot text check (loser_next_slot in ('a', 'b')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (participant_a_id, tournament_id)
    references public.participants (id, tournament_id),
  foreign key (participant_b_id, tournament_id)
    references public.participants (id, tournament_id),

  constraint matches_slot_unique
    unique nulls not distinct (tournament_id, stage, group_label, round, position),
  constraint matches_number_unique unique (tournament_id, number),
  constraint matches_distinct_sides
    check (participant_a_id is null or participant_b_id is null
           or participant_a_id <> participant_b_id),
  -- `is not distinct from`, not `in (...)`: a CHECK passes on NULL, so
  -- `winner_id in (a, NULL)` would accept any winner at all.
  constraint matches_winner_is_a_side
    check (winner_id is null
           or winner_id is not distinct from participant_a_id
           or winner_id is not distinct from participant_b_id),
  constraint matches_decided_has_winner
    check ((status in ('completed', 'walkover', 'bye')) = (winner_id is not null)),
  constraint matches_next_paired
    check ((next_match_id is null) = (next_slot is null)),
  constraint matches_loser_next_paired
    check ((loser_next_match_id is null) = (loser_next_slot is null)),
  constraint matches_group_labelled
    check ((stage = 'group') = (group_label is not null))
);

create index matches_tournament_idx on public.matches (tournament_id, stage, round, position);
create index matches_participant_a_idx on public.matches (participant_a_id);
create index matches_participant_b_idx on public.matches (participant_b_id);
create index matches_next_idx on public.matches (next_match_id);
create index matches_loser_next_idx on public.matches (loser_next_match_id);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function private.set_updated_at();
