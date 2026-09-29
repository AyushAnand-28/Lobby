-- =============================================================================
-- Courts, live scoring, the scorer link and realtime
--
-- - tournaments.court_count: how many courts the venue has. A match is called
--   to a court by number and leaves it when its result is recorded.
-- - matches.live: the rally log of a match scored point by point, so scoring
--   survives a reload or a change of phone. `games` stays the score of record;
--   `live` only adds who won each rally, which is what service and undo need.
-- - scorer_tokens: ONE shared, rotatable link per tournament for volunteers at
--   the courts. Like the registration link, the token is the credential. It
--   can call matches to courts and record scores through the scorer_*
--   functions below, and nothing else: no entries, no draw, no settings, no
--   contact details.
-- - Realtime: matches, tournaments and participants join the
--   `supabase_realtime` publication so the public page updates as results
--   land. Row level security still decides who receives which rows.
--
-- record_match_result() is rebuilt around a shared private core so the
-- organizer and the scorer link run exactly the same rules.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------

alter table public.tournaments
  add column court_count smallint check (court_count between 1 and 40);

alter table public.matches
  add column live jsonb
    check (live is null or (jsonb_typeof(live) = 'object' and pg_column_size(live) <= 4096));

-- Courts are stored as their number: "1", "2", ... "40".
alter table public.matches
  add constraint matches_court_number check (court is null or court ~ '^[1-9][0-9]?$');

-- One match on a court at a time. Recording a result clears `court`, so the
-- index only ever holds matches that are on court right now.
create unique index matches_court_occupied
  on public.matches (tournament_id, court)
  where court is not null;

-- -----------------------------------------------------------------------------
-- scorer_tokens — ONE shared, reusable scorer link per tournament
-- -----------------------------------------------------------------------------

create table public.scorer_tokens (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(token) >= 24),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index scorer_tokens_one_active
  on public.scorer_tokens (tournament_id)
  where revoked_at is null;

alter table public.scorer_tokens enable row level security;
revoke all on public.scorer_tokens from anon;

create policy "Organizers read their scorer links"
  on public.scorer_tokens for select to authenticated
  using (private.is_tournament_owner(tournament_id));

create policy "Organizers create scorer links"
  on public.scorer_tokens for insert to authenticated
  with check (private.is_tournament_owner(tournament_id));

create policy "Organizers revoke scorer links"
  on public.scorer_tokens for update to authenticated
  using (private.is_tournament_owner(tournament_id))
  with check (private.is_tournament_owner(tournament_id));

-- Every tournament is born with one, as with the registration link.
create or replace function private.create_scorer_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.scorer_tokens (tournament_id) values (new.id);
  return new;
end;
$$;

create trigger tournaments_create_scorer_token
  after insert on public.tournaments
  for each row execute function private.create_scorer_token();

-- Tournaments created before this migration ran.
insert into public.scorer_tokens (tournament_id)
select t.id
from public.tournaments t
where not exists (
  select 1 from public.scorer_tokens s
  where s.tournament_id = t.id and s.revoked_at is null
);

/* Revoke the active scorer link and issue a new one. The old URL stops working. */
create or replace function public.rotate_scorer_token(p_tournament_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text;
begin
  if not private.is_tournament_owner(p_tournament_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update public.scorer_tokens
  set revoked_at = now()
  where tournament_id = p_tournament_id and revoked_at is null;

  insert into public.scorer_tokens (tournament_id)
  values (p_tournament_id)
  returning token into v_token;

  return v_token;
end;
$$;

/* Lock and return the tournament behind a live scorer link, or raise. */
create or replace function private.lock_scorer_tournament(p_token text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select t.id into v_id
  from public.scorer_tokens s
  join public.tournaments t on t.id = s.tournament_id
  where s.token = p_token and s.revoked_at is null
  for update of t;

  if not found then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

/*
 * What the scorer page needs to know about its tournament. NULL for an
 * unknown or revoked token. Everything else the page shows — matches and
 * approved entries — it reads through the same row level security as any
 * spectator.
 */
create or replace function public.scorer_session(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_t public.tournaments;
begin
  select t.* into v_t
  from public.scorer_tokens s
  join public.tournaments t on t.id = s.tournament_id
  where s.token = p_token and s.revoked_at is null;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_t.id,
    'slug', v_t.slug,
    'name', v_t.name,
    'sport', v_t.sport,
    'format', v_t.format,
    'status', v_t.status,
    'settings', v_t.settings,
    'court_count', v_t.court_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Results — one core, two ways in
-- -----------------------------------------------------------------------------

/*
 * Record, correct or clear a match result. The caller has already locked the
 * tournament and established that it may write to it.
 *
 * Same rules as before, plus:
 * - `p_live` is stored as the match's rally log (NULL clears it — a typed-in
 *   final score replaces any rally history).
 * - A decided match leaves its court.
 *
 * SECURITY INVOKER: on the organizer's path row level security still applies,
 * so even a direct call can only touch the caller's own matches.
 */
create or replace function private.apply_match_result(
  p_match_id uuid,
  p_status text,
  p_games jsonb,
  p_winner_id uuid,
  p_live jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_m public.matches;
  v_tournament_status text;
  v_games jsonb := private.normalize_games(p_games);
  v_winner uuid := case when p_status in ('completed', 'walkover') then p_winner_id end;
  v_decided boolean := p_status in ('completed', 'walkover');
  v_loser uuid;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select t.status into v_tournament_status
  from public.tournaments t where t.id = v_m.tournament_id;

  if v_tournament_status not in ('in_progress', 'completed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_m.status = 'bye' then
    raise exception 'bye_match' using errcode = 'P0001';
  end if;
  if v_m.participant_a_id is null or v_m.participant_b_id is null then
    raise exception 'participants_pending' using errcode = 'P0001';
  end if;
  if p_status not in ('scheduled', 'in_progress', 'completed', 'walkover') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_decided
     and v_winner is distinct from v_m.participant_a_id
     and v_winner is distinct from v_m.participant_b_id then
    raise exception 'invalid_winner' using errcode = 'P0001';
  end if;
  if p_live is not null
     and (jsonb_typeof(p_live) <> 'object' or pg_column_size(p_live) > 4096) then
    raise exception 'invalid_live' using errcode = 'P0001';
  end if;

  -- Group results feed the knockout seeding. Once that is drawn they are final.
  if v_m.stage = 'group' and exists (
    select 1 from public.matches k
    where k.tournament_id = v_m.tournament_id and k.stage in ('knockout', 'third_place')
  ) then
    raise exception 'group_stage_locked' using errcode = 'P0001';
  end if;

  if v_winner is distinct from v_m.winner_id and exists (
    select 1 from public.matches d
    where d.id in (v_m.next_match_id, v_m.loser_next_match_id)
      and (d.status <> 'scheduled' or d.games <> '[]'::jsonb)
  ) then
    raise exception 'downstream_started' using errcode = 'P0001';
  end if;

  update public.matches
  set status = p_status,
      games = v_games,
      winner_id = v_winner,
      live = p_live,
      court = case when v_decided then null else court end,
      started_at = case when p_status = 'scheduled' then null else coalesce(started_at, now()) end,
      completed_at = case when v_decided then coalesce(completed_at, now()) end
  where id = v_m.id;

  if v_m.next_match_id is not null then
    if v_m.next_slot = 'a' then
      update public.matches set participant_a_id = v_winner where id = v_m.next_match_id;
    else
      update public.matches set participant_b_id = v_winner where id = v_m.next_match_id;
    end if;
  end if;

  if v_m.loser_next_match_id is not null then
    v_loser := case
      when v_winner is null then null
      when v_winner = v_m.participant_a_id then v_m.participant_b_id
      else v_m.participant_a_id
    end;
    if v_m.loser_next_slot = 'a' then
      update public.matches set participant_a_id = v_loser where id = v_m.loser_next_match_id;
    else
      update public.matches set participant_b_id = v_loser where id = v_m.loser_next_match_id;
    end if;
  end if;

  perform private.sync_tournament_status(v_m.tournament_id);
end;
$$;

-- The organizer's way in. Replaces the four-argument version; callers passing
-- four arguments still resolve to this one through the default.
drop function public.record_match_result(uuid, text, jsonb, uuid);

create function public.record_match_result(
  p_match_id uuid,
  p_status text,
  p_games jsonb,
  p_winner_id uuid default null,
  p_live jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  select m.tournament_id into v_tournament_id from public.matches m where m.id = p_match_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Tournament before match, the same order generate_fixtures() locks in.
  perform private.lock_own_tournament(v_tournament_id);
  perform private.apply_match_result(p_match_id, p_status, p_games, p_winner_id, p_live);
end;
$$;

-- The scorer link's way in.
create or replace function public.scorer_record_result(
  p_token text,
  p_match_id uuid,
  p_status text,
  p_games jsonb,
  p_winner_id uuid default null,
  p_live jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid := private.lock_scorer_tournament(p_token);
begin
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.tournament_id = v_tournament_id
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.apply_match_result(p_match_id, p_status, p_games, p_winner_id, p_live);
end;
$$;

-- -----------------------------------------------------------------------------
-- Courts
-- -----------------------------------------------------------------------------

/*
 * Call a match to a court, move it to another, or (p_court NULL) take it off.
 * The caller has already locked the tournament and may write to it.
 */
create or replace function private.apply_court(p_match_id uuid, p_court text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_m public.matches;
  v_t public.tournaments;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select * into v_t from public.tournaments where id = v_m.tournament_id;

  if p_court is null then
    update public.matches set court = null where id = v_m.id;
    return;
  end if;

  if v_t.status <> 'in_progress' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if v_t.court_count is null then
    raise exception 'courts_not_set' using errcode = 'P0001';
  end if;
  if v_m.status not in ('scheduled', 'in_progress') then
    raise exception 'match_decided' using errcode = 'P0001';
  end if;
  if v_m.participant_a_id is null or v_m.participant_b_id is null then
    raise exception 'participants_pending' using errcode = 'P0001';
  end if;
  if p_court !~ '^[1-9][0-9]?$' or p_court::integer > v_t.court_count then
    raise exception 'invalid_court' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.matches o
    where o.tournament_id = v_m.tournament_id and o.court = p_court and o.id <> v_m.id
  ) then
    raise exception 'court_busy' using errcode = 'P0001';
  end if;

  update public.matches set court = p_court where id = v_m.id;
end;
$$;

create or replace function public.assign_court(p_match_id uuid, p_court text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  select m.tournament_id into v_tournament_id from public.matches m where m.id = p_match_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.lock_own_tournament(v_tournament_id);
  perform private.apply_court(p_match_id, p_court);
end;
$$;

create or replace function public.scorer_assign_court(p_token text, p_match_id uuid, p_court text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid := private.lock_scorer_tournament(p_token);
begin
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.tournament_id = v_tournament_id
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  perform private.apply_court(p_match_id, p_court);
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on function private.create_scorer_token() from public;
revoke all on function private.lock_scorer_tournament(text) from public;
revoke all on function private.apply_match_result(uuid, text, jsonb, uuid, jsonb) from public;
revoke all on function private.apply_court(uuid, text) from public;

-- The organizer's invoker functions call these as `authenticated`.
grant execute on function private.apply_match_result(uuid, text, jsonb, uuid, jsonb) to authenticated;
grant execute on function private.apply_court(uuid, text) to authenticated;

revoke all on function public.rotate_scorer_token(uuid) from public, anon;
revoke all on function public.record_match_result(uuid, text, jsonb, uuid, jsonb) from public, anon;
revoke all on function public.assign_court(uuid, text) from public, anon;
grant execute on function public.rotate_scorer_token(uuid) to authenticated;
grant execute on function public.record_match_result(uuid, text, jsonb, uuid, jsonb) to authenticated;
grant execute on function public.assign_court(uuid, text) to authenticated;

revoke all on function public.scorer_session(text) from public;
revoke all on function public.scorer_record_result(text, uuid, text, jsonb, uuid, jsonb) from public;
revoke all on function public.scorer_assign_court(text, uuid, text) from public;
grant execute on function public.scorer_session(text) to anon, authenticated;
grant execute on function public.scorer_record_result(text, uuid, text, jsonb, uuid, jsonb) to anon, authenticated;
grant execute on function public.scorer_assign_court(text, uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
--
-- Guarded, because the publication only exists on a Supabase project (the
-- test database has none) and a table already added from the dashboard would
-- otherwise make ALTER PUBLICATION fail.
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach v_table in array array['matches', 'tournaments', 'participants'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
