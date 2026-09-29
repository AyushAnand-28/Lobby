-- =============================================================================
-- Tournament functions
--
-- Everything that writes to more than one row at once lives here, so it runs
-- in a single transaction: a bracket is never left half-advanced and a fixture
-- list is never half-inserted.
--
-- Split of responsibilities with the app:
-- - The sport module (TypeScript) owns the *rules*: whether 21-19 is a legal
--   badminton game, who won the match, how the draw is seeded.
-- - These functions own *structural integrity*: who may call them, that the
--   draw is not changed under a match already being played, that a winner
--   moves into the right slot of the right next match.
--
-- The organizer-facing functions are SECURITY INVOKER, so row level security
-- still applies inside them. Only the two registration functions are SECURITY
-- DEFINER, because anonymous captains must reach a table they cannot see.
--
-- Errors are raised with a short machine-readable message (`registration_full`,
-- `downstream_started`, ...) that lib/ maps to human copy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registration
-- -----------------------------------------------------------------------------

/*
 * Why a registration link is not accepting entries right now, or NULL when it
 * is. Mirrored in lib/tournament/registration.ts for the organizer's UI; the
 * database copy is the one that is enforced.
 */
create or replace function private.registration_block_reason(
  p_tournament public.tournaments,
  p_live_entries integer
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_tournament.status = 'draft' then 'not_published'
    when p_tournament.status <> 'registration' then 'started'
    when not p_tournament.registration_open then 'closed'
    when p_tournament.registration_closes_at is not null
         and now() >= p_tournament.registration_closes_at then 'deadline_passed'
    when p_live_entries >= coalesce(p_tournament.max_participants, 256) then 'full'
    else null
  end;
$$;

/*
 * What a captain sees on opening the shared link. Returns NULL for an unknown
 * or revoked token — the page renders the same "link not valid" state for
 * both, so a guessed token learns nothing.
 */
create or replace function public.registration_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_t public.tournaments;
  v_live integer;
  v_reason text;
begin
  select t.* into v_t
  from public.registration_tokens rt
  join public.tournaments t on t.id = rt.tournament_id
  where rt.token = p_token and rt.revoked_at is null;

  if not found then
    return null;
  end if;

  -- A draft is private. Confirm the link is real, reveal nothing else.
  if v_t.status = 'draft' then
    return jsonb_build_object(
      'accepting', false,
      'reason', 'not_published',
      'live_entries', 0,
      'tournament', null
    );
  end if;

  select count(*) into v_live
  from public.participants p
  where p.tournament_id = v_t.id and p.status in ('pending', 'approved');

  v_reason := private.registration_block_reason(v_t, v_live);

  return jsonb_build_object(
    'accepting', v_reason is null,
    'reason', coalesce(v_reason, 'open'),
    'live_entries', v_live,
    'tournament', jsonb_build_object(
      'id', v_t.id,
      'slug', v_t.slug,
      'name', v_t.name,
      'sport', v_t.sport,
      'format', v_t.format,
      'description', v_t.description,
      'venue', v_t.venue,
      'host_name', v_t.host_name,
      'contact_phone', v_t.contact_phone,
      'starts_on', v_t.starts_on,
      'ends_on', v_t.ends_on,
      'settings', v_t.settings,
      'roster_min', v_t.roster_min,
      'roster_max', v_t.roster_max,
      'max_participants', v_t.max_participants,
      'registration_closes_at', v_t.registration_closes_at
    )
  );
end;
$$;

/*
 * A captain submits an entry from the shared link. It lands as `pending`; the
 * organizer approves it.
 *
 * The tournament row is locked for the length of the call so two captains
 * racing for the last slot cannot both get in.
 */
create or replace function public.submit_registration(
  p_token text,
  p_name text,
  p_players text[],
  p_captain_name text,
  p_phone text,
  p_email text default null,
  p_club text default null,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_t public.tournaments;
  v_live integer;
  v_total integer;
  v_reason text;
  v_players text[];
  v_name text := btrim(coalesce(p_name, ''));
  v_captain text := btrim(coalesce(p_captain_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_club text := nullif(btrim(coalesce(p_club, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  select t.* into v_t
  from public.registration_tokens rt
  join public.tournaments t on t.id = rt.tournament_id
  where rt.token = p_token and rt.revoked_at is null
  for update of t;

  if not found then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  select
    count(*) filter (where p.status in ('pending', 'approved')),
    count(*)
  into v_live, v_total
  from public.participants p
  where p.tournament_id = v_t.id;

  v_reason := private.registration_block_reason(v_t, v_live);
  -- Rejected entries free a slot, so bound the table too: a leaked link must
  -- not be able to write rows forever.
  if v_reason is null and v_total >= 512 then
    v_reason := 'full';
  end if;
  if v_reason is not null then
    raise exception 'registration_%', v_reason using errcode = 'P0001';
  end if;

  v_players := array(
    select btrim(x)
    from unnest(coalesce(p_players, '{}'::text[])) with ordinality as u(x, n)
    where btrim(x) <> ''
    order by n
  );

  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if cardinality(v_players) < v_t.roster_min
     or cardinality(v_players) > v_t.roster_max
     or exists (select 1 from unnest(v_players) x where char_length(x) > 80) then
    raise exception 'invalid_players' using errcode = 'P0001';
  end if;
  if char_length(v_captain) not between 1 and 80 then
    raise exception 'invalid_captain' using errcode = 'P0001';
  end if;
  if v_phone is null or char_length(v_phone) > 32 then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;
  if char_length(v_email) > 254 or char_length(v_club) > 120 or char_length(v_note) > 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.participants p
    where p.tournament_id = v_t.id
      and p.status in ('pending', 'approved')
      and lower(p.name) = lower(v_name)
  ) then
    raise exception 'duplicate_name' using errcode = 'P0001';
  end if;

  insert into public.participants (tournament_id, name, club, players, status, source)
  values (v_t.id, v_name, v_club, v_players, 'pending', 'registration')
  returning id into v_id;

  insert into public.participant_contacts (participant_id, tournament_id, captain_name, phone, email, note)
  values (v_id, v_t.id, v_captain, v_phone, v_email, v_note);

  return v_id;
end;
$$;

/* Revoke the active link and issue a new one. The old URL stops working. */
create or replace function public.rotate_registration_token(p_tournament_id uuid)
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

  update public.registration_tokens
  set revoked_at = now()
  where tournament_id = p_tournament_id and revoked_at is null;

  insert into public.registration_tokens (tournament_id)
  values (p_tournament_id)
  returning token into v_token;

  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------

/* Lock and return the caller's tournament, or raise. */
create or replace function private.lock_own_tournament(p_tournament_id uuid)
returns public.tournaments
language plpgsql
set search_path = ''
as $$
declare
  v_t public.tournaments;
begin
  select * into v_t
  from public.tournaments
  where id = p_tournament_id and organizer_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_t;
end;
$$;

/*
 * Insert a planned set of matches. The plan comes from the app's fixture
 * generator, with ids pre-assigned so next-match links resolve in the same
 * statement (foreign keys are checked at the end of it).
 */
create or replace function private.insert_planned_matches(p_tournament_id uuid, p_matches jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) = 0 then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;

  -- Only this tournament's approved entries may appear in the draw.
  if exists (
    select 1
    from jsonb_to_recordset(p_matches) as x(participant_a_id uuid, participant_b_id uuid)
    cross join lateral (values (x.participant_a_id), (x.participant_b_id)) as side(pid)
    where side.pid is not null
      and not exists (
        select 1 from public.participants p
        where p.id = side.pid
          and p.tournament_id = p_tournament_id
          and p.status = 'approved'
      )
  ) then
    raise exception 'invalid_participant' using errcode = 'P0001';
  end if;

  insert into public.matches (
    id, tournament_id, stage, group_label, round, position, number,
    participant_a_id, participant_b_id, status, winner_id,
    next_match_id, next_slot, loser_next_match_id, loser_next_slot, completed_at
  )
  select
    x.id, p_tournament_id, x.stage, x.group_label, x.round, x.position, x.number,
    x.participant_a_id, x.participant_b_id, x.status, x.winner_id,
    x.next_match_id, x.next_slot, x.loser_next_match_id, x.loser_next_slot,
    case when x.status = 'bye' then now() end
  from jsonb_to_recordset(p_matches) as x(
    id uuid, stage text, group_label text, round smallint, position smallint,
    number smallint, participant_a_id uuid, participant_b_id uuid, status text,
    winner_id uuid, next_match_id uuid, next_slot text,
    loser_next_match_id uuid, loser_next_slot text
  );

  if exists (
    select 1 from jsonb_to_recordset(p_matches) as x(status text)
    where x.status not in ('scheduled', 'bye')
  ) then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;
end;
$$;

/* True when any real match in the given stages has a result or is under way. */
create or replace function private.has_played_matches(p_tournament_id uuid, p_stages text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.tournament_id = p_tournament_id
      and (p_stages is null or m.stage = any (p_stages))
      and m.status in ('in_progress', 'completed', 'walkover')
  );
$$;

/*
 * Replace the draw. Allowed while registration is running, or while in play
 * as long as nothing has been played yet — so an organizer can reseed after
 * spotting a mistake, but cannot wipe a score.
 *
 * p_groups: [{ "id": <participant>, "group_label": "A" }, ...] for group
 * formats; empty otherwise.
 */
create or replace function public.generate_fixtures(
  p_tournament_id uuid,
  p_matches jsonb,
  p_groups jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.tournaments;
begin
  v_t := private.lock_own_tournament(p_tournament_id);

  if v_t.status not in ('registration', 'in_progress') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if private.has_played_matches(p_tournament_id, null) then
    raise exception 'fixtures_locked' using errcode = 'P0001';
  end if;

  delete from public.matches where tournament_id = p_tournament_id;

  update public.participants
  set group_label = null
  where tournament_id = p_tournament_id and group_label is not null;

  update public.participants p
  set group_label = g.group_label
  from jsonb_to_recordset(coalesce(p_groups, '[]'::jsonb)) as g(id uuid, group_label text)
  where p.id = g.id and p.tournament_id = p_tournament_id and p.status = 'approved';

  perform private.insert_planned_matches(p_tournament_id, p_matches);

  perform set_config('lobby.fixture_op', 'on', true);
  update public.tournaments
  set status = 'in_progress', registration_open = false, completed_at = null
  where id = p_tournament_id;
  perform set_config('lobby.fixture_op', 'off', true);

  -- A knockout of two byes-only rounds cannot happen, but a two-entry league
  -- with one bye match can; settle status against what was actually inserted.
  perform private.sync_tournament_status(p_tournament_id);
end;
$$;

/*
 * Groups-then-knockout: add the knockout once every group match is decided.
 * The app seeds it from the final group standings.
 */
create or replace function public.add_knockout_stage(p_tournament_id uuid, p_matches jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.tournaments;
begin
  v_t := private.lock_own_tournament(p_tournament_id);

  if v_t.format <> 'groups_knockout' then
    raise exception 'invalid_format' using errcode = 'P0001';
  end if;
  if v_t.status not in ('in_progress', 'completed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.matches m
    where m.tournament_id = p_tournament_id and m.stage in ('knockout', 'third_place')
  ) then
    raise exception 'knockout_exists' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.matches m
    where m.tournament_id = p_tournament_id
      and m.stage = 'group'
      and m.status not in ('completed', 'walkover', 'bye')
  ) then
    raise exception 'groups_incomplete' using errcode = 'P0001';
  end if;

  perform private.insert_planned_matches(p_tournament_id, p_matches);

  if exists (
    select 1 from jsonb_to_recordset(p_matches) as x(stage text)
    where x.stage not in ('knockout', 'third_place')
  ) then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;

  perform private.sync_tournament_status(p_tournament_id);
end;
$$;

/*
 * Throw the draw away. `all` returns the tournament to registration; `knockout`
 * removes only the knockout of a groups tournament so it can be reseeded.
 * Either way, nothing that has been played can be deleted.
 */
create or replace function public.reset_fixtures(p_tournament_id uuid, p_scope text default 'all')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.tournaments;
  v_stages text[];
begin
  v_t := private.lock_own_tournament(p_tournament_id);

  if p_scope = 'all' then
    v_stages := null;
  elsif p_scope = 'knockout' and v_t.format = 'groups_knockout' then
    v_stages := array['knockout', 'third_place'];
  else
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  if private.has_played_matches(p_tournament_id, v_stages) then
    raise exception 'fixtures_locked' using errcode = 'P0001';
  end if;

  delete from public.matches
  where tournament_id = p_tournament_id
    and (v_stages is null or stage = any (v_stages));

  if p_scope = 'all' then
    update public.participants
    set group_label = null
    where tournament_id = p_tournament_id and group_label is not null;

    if v_t.status in ('in_progress', 'completed') then
      perform set_config('lobby.fixture_op', 'on', true);
      update public.tournaments
      set status = 'registration', completed_at = null
      where id = p_tournament_id;
      perform set_config('lobby.fixture_op', 'off', true);
    end if;
  else
    perform private.sync_tournament_status(p_tournament_id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Results
-- -----------------------------------------------------------------------------

/* Strip a games payload to [{a:int, b:int}, ...] or raise. */
create or replace function private.normalize_games(p_games jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_games is null then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) > 7 then
    raise exception 'invalid_games' using errcode = 'P0001';
  end if;
  -- CASE, not a chain of ORs: SQL does not promise to short-circuit, and the
  -- numeric casts must never see a string.
  if exists (
    select 1 from jsonb_array_elements(p_games) g
    where case
      when jsonb_typeof(g) <> 'object' then true
      when jsonb_typeof(g -> 'a') is distinct from 'number'
        or jsonb_typeof(g -> 'b') is distinct from 'number' then true
      else (g ->> 'a')::numeric not between 0 and 99
        or (g ->> 'b')::numeric not between 0 and 99
        or (g ->> 'a')::numeric <> trunc((g ->> 'a')::numeric)
        or (g ->> 'b')::numeric <> trunc((g ->> 'b')::numeric)
    end
  ) then
    raise exception 'invalid_games' using errcode = 'P0001';
  end if;

  return coalesce(
    (select jsonb_agg(jsonb_build_object('a', (g ->> 'a')::int, 'b', (g ->> 'b')::int) order by n)
     from jsonb_array_elements(p_games) with ordinality as e(g, n)),
    '[]'::jsonb
  );
end;
$$;

/*
 * Move a tournament between in_progress and completed to match its matches.
 * Complete means every match is decided — and, for groups-then-knockout, that
 * the knockout has actually been drawn.
 */
create or replace function private.sync_tournament_status(p_tournament_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_format text;
  v_status text;
  v_total integer;
  v_open integer;
  v_has_knockout boolean;
  v_target text;
begin
  select t.format, t.status into v_format, v_status
  from public.tournaments t where t.id = p_tournament_id;

  if v_status not in ('in_progress', 'completed') then
    return;
  end if;

  select
    count(*),
    count(*) filter (where m.status not in ('completed', 'walkover', 'bye')),
    coalesce(bool_or(m.stage in ('knockout', 'third_place')), false)
  into v_total, v_open, v_has_knockout
  from public.matches m
  where m.tournament_id = p_tournament_id;

  v_target := case
    when v_total > 0 and v_open = 0 and (v_format <> 'groups_knockout' or v_has_knockout)
      then 'completed'
    else 'in_progress'
  end;

  if v_target is distinct from v_status then
    perform set_config('lobby.fixture_op', 'on', true);
    update public.tournaments
    set status = v_target,
        completed_at = case when v_target = 'completed' then now() end
    where id = p_tournament_id;
    perform set_config('lobby.fixture_op', 'off', true);
  end if;
end;
$$;

/*
 * Record, correct or clear a match result.
 *
 * p_status   scheduled | in_progress | completed | walkover
 * p_games    per-game scores, already validated by the sport module
 * p_winner   required for completed/walkover, ignored otherwise
 *
 * The winner (and, into a third-place playoff, the loser) is written into the
 * next match's slot. If a correction would change who went through, and the
 * next match has already started, it is refused: that match would otherwise
 * silently change players mid-game.
 */
create or replace function public.record_match_result(
  p_match_id uuid,
  p_status text,
  p_games jsonb,
  p_winner_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_m public.matches;
  v_t public.tournaments;
  v_games jsonb := private.normalize_games(p_games);
  v_winner uuid := case when p_status in ('completed', 'walkover') then p_winner_id end;
  v_loser uuid;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  v_t := private.lock_own_tournament(v_m.tournament_id);

  if v_t.status not in ('in_progress', 'completed') then
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
  if p_status in ('completed', 'walkover')
     and v_winner is distinct from v_m.participant_a_id
     and v_winner is distinct from v_m.participant_b_id then
    raise exception 'invalid_winner' using errcode = 'P0001';
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
      started_at = case when p_status = 'scheduled' then null else coalesce(started_at, now()) end,
      completed_at = case
        when p_status in ('completed', 'walkover') then coalesce(completed_at, now())
      end
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

-- -----------------------------------------------------------------------------
-- Privileges
--
-- Supabase grants EXECUTE on new public functions to anon by default. Revoke
-- it explicitly: invoker functions would be stopped by RLS anyway, but an
-- organizer-only RPC should not even be callable without a session.
-- -----------------------------------------------------------------------------

revoke all on function private.registration_block_reason(public.tournaments, integer) from public;
revoke all on function private.lock_own_tournament(uuid) from public;
revoke all on function private.insert_planned_matches(uuid, jsonb) from public;
revoke all on function private.has_played_matches(uuid, text[]) from public;
revoke all on function private.normalize_games(jsonb) from public;
revoke all on function private.sync_tournament_status(uuid) from public;

grant execute on function private.lock_own_tournament(uuid) to authenticated;
grant execute on function private.insert_planned_matches(uuid, jsonb) to authenticated;
grant execute on function private.has_played_matches(uuid, text[]) to authenticated;
grant execute on function private.normalize_games(jsonb) to authenticated;
grant execute on function private.sync_tournament_status(uuid) to authenticated;

revoke all on function public.registration_preview(text) from public;
revoke all on function public.submit_registration(text, text, text[], text, text, text, text, text) from public;
grant execute on function public.registration_preview(text) to anon, authenticated;
grant execute on function public.submit_registration(text, text, text[], text, text, text, text, text) to anon, authenticated;

revoke all on function public.rotate_registration_token(uuid) from public, anon;
revoke all on function public.generate_fixtures(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.add_knockout_stage(uuid, jsonb) from public, anon;
revoke all on function public.reset_fixtures(uuid, text) from public, anon;
revoke all on function public.record_match_result(uuid, text, jsonb, uuid) from public, anon;

grant execute on function public.rotate_registration_token(uuid) to authenticated;
grant execute on function public.generate_fixtures(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.add_knockout_stage(uuid, jsonb) to authenticated;
grant execute on function public.reset_fixtures(uuid, text) to authenticated;
grant execute on function public.record_match_result(uuid, text, jsonb, uuid) to authenticated;
