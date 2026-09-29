-- =============================================================================
-- Row level security
--
-- Three audiences:
--   organizer  authenticated; full control of their own tournaments only
--   spectator  anon; reads published tournaments, approved entries, matches
--   captain    anon; never touches a table directly — registration goes
--              through public.submit_registration() (next migration)
--
-- Contact details and registration tokens are organizer-only. There is no anon
-- INSERT policy anywhere: a plain RLS policy cannot see the registration token,
-- so anonymous writes are funnelled through a SECURITY DEFINER function that
-- validates it instead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Policy helpers
--
-- SECURITY DEFINER so a policy on a child table does not re-enter the
-- tournaments policies on every row. They live in `private`, which the Data
-- API does not expose, and reveal nothing but a boolean about the caller.
-- -----------------------------------------------------------------------------

create or replace function private.is_tournament_owner(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_tournament_id
      and t.organizer_id = (select auth.uid())
  );
$$;

create or replace function private.is_tournament_public(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = p_tournament_id
      and t.status <> 'draft'
  );
$$;

revoke all on function private.is_tournament_owner(uuid) from public;
revoke all on function private.is_tournament_public(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_tournament_owner(uuid) to anon, authenticated;
grant execute on function private.is_tournament_public(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

alter table public.organizers enable row level security;
alter table public.sports enable row level security;
alter table public.tournaments enable row level security;
alter table public.registration_tokens enable row level security;
alter table public.participants enable row level security;
alter table public.participant_contacts enable row level security;
alter table public.matches enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges
--
-- Supabase grants anon and authenticated full DML on new public tables by
-- default and relies on RLS alone. RLS below is the real boundary; these
-- revokes are a second one, so a future permissive policy cannot accidentally
-- open writes or private tables to anonymous callers.
-- -----------------------------------------------------------------------------

revoke all on public.organizers, public.registration_tokens, public.participant_contacts from anon;
revoke insert, update, delete, truncate on public.sports, public.tournaments, public.participants, public.matches from anon;
revoke insert, update, delete, truncate on public.sports from authenticated;

-- -----------------------------------------------------------------------------
-- organizers
-- -----------------------------------------------------------------------------

create policy "Organizers read their own profile"
  on public.organizers for select to authenticated
  using (id = (select auth.uid()));

create policy "Organizers create their own profile"
  on public.organizers for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Organizers update their own profile"
  on public.organizers for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- sports — public reference data
-- -----------------------------------------------------------------------------

create policy "Anyone reads sports"
  on public.sports for select to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- tournaments
--
-- One SELECT policy per table rather than an owner policy plus a public one:
-- Postgres ORs permissive policies per row, and two of them doubles the work
-- on every read.
-- -----------------------------------------------------------------------------

create policy "Read own or published tournaments"
  on public.tournaments for select to anon, authenticated
  using (status <> 'draft' or organizer_id = (select auth.uid()));

create policy "Organizers create tournaments"
  on public.tournaments for insert to authenticated
  with check (organizer_id = (select auth.uid()));

create policy "Organizers update their own tournaments"
  on public.tournaments for update to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

create policy "Organizers delete their own tournaments"
  on public.tournaments for delete to authenticated
  using (organizer_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- registration_tokens — organizer only
-- -----------------------------------------------------------------------------

create policy "Organizers read their registration links"
  on public.registration_tokens for select to authenticated
  using (private.is_tournament_owner(tournament_id));

create policy "Organizers create registration links"
  on public.registration_tokens for insert to authenticated
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers revoke registration links"
  on public.registration_tokens for update to authenticated
  using (private.is_tournament_owner(tournament_id))
  with check (private.is_tournament_owner(tournament_id));

-- -----------------------------------------------------------------------------
-- participants
--
-- Spectators see approved entries, and withdrawn ones too — a withdrawn entry
-- may already sit in the fixture list, and its name has to render there.
-- Pending and rejected entries are the organizer's business only.
-- -----------------------------------------------------------------------------

create policy "Read own entries or public entries"
  on public.participants for select to anon, authenticated
  using (
    private.is_tournament_owner(tournament_id)
    or (status in ('approved', 'withdrawn') and private.is_tournament_public(tournament_id))
  );

create policy "Organizers add entries"
  on public.participants for insert to authenticated
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers update entries"
  on public.participants for update to authenticated
  using (private.is_tournament_owner(tournament_id))
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers delete entries"
  on public.participants for delete to authenticated
  using (private.is_tournament_owner(tournament_id));

-- -----------------------------------------------------------------------------
-- participant_contacts — organizer only, never public
-- -----------------------------------------------------------------------------

create policy "Organizers read entry contacts"
  on public.participant_contacts for select to authenticated
  using (private.is_tournament_owner(tournament_id));

create policy "Organizers add entry contacts"
  on public.participant_contacts for insert to authenticated
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers update entry contacts"
  on public.participant_contacts for update to authenticated
  using (private.is_tournament_owner(tournament_id))
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers delete entry contacts"
  on public.participant_contacts for delete to authenticated
  using (private.is_tournament_owner(tournament_id));

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------

create policy "Read own or published matches"
  on public.matches for select to anon, authenticated
  using (
    private.is_tournament_owner(tournament_id)
    or private.is_tournament_public(tournament_id)
  );

create policy "Organizers add matches"
  on public.matches for insert to authenticated
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers update matches"
  on public.matches for update to authenticated
  using (private.is_tournament_owner(tournament_id))
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers delete matches"
  on public.matches for delete to authenticated
  using (private.is_tournament_owner(tournament_id));

-- -----------------------------------------------------------------------------
-- Tournament guard
--
-- RLS decides *who* may write; this decides *what* may change. Once fixtures
-- exist, the draw's shape and the scoring rules are frozen — changing the
-- format or points-to-win under a half-played bracket would silently corrupt
-- it. Status moves into and out of play only through the fixture functions,
-- which raise the `lobby.fixture_op` flag for the length of their transaction.
-- -----------------------------------------------------------------------------

create or replace function private.guard_tournament_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_in_play constant text[] := array['in_progress', 'completed'];
  v_fixture_op boolean := coalesce(current_setting('lobby.fixture_op', true), '') = 'on';
begin
  if new.organizer_id is distinct from old.organizer_id then
    raise exception 'organizer_immutable' using errcode = 'P0001';
  end if;

  if old.status = any (v_in_play) and (
       new.sport is distinct from old.sport
    or new.format is distinct from old.format
    or new.settings is distinct from old.settings
    or new.third_place_match is distinct from old.third_place_match
    or new.group_count is distinct from old.group_count
    or new.advance_per_group is distinct from old.advance_per_group
    or new.roster_min is distinct from old.roster_min
    or new.roster_max is distinct from old.roster_max
  ) then
    raise exception 'draw_locked' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status
     and (new.status = any (v_in_play) or old.status = any (v_in_play))
     and not v_fixture_op then
    raise exception 'status_managed_by_fixtures' using errcode = 'P0001';
  end if;

  if new.status = 'registration' and old.status = 'draft' then
    new.published_at := coalesce(old.published_at, now());
  end if;

  return new;
end;
$$;

create trigger tournaments_guard_update
  before update on public.tournaments
  for each row execute function private.guard_tournament_update();
