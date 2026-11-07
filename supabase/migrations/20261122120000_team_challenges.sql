-- Phase 1, sprint 1: a walking challenge roster. No scores yet.
-- The organizer can run one without joining. The board is team names and counts only.

create or replace function public.challenge_new_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  for i in 0..11 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.challenge_new_code(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  kind text not null,
  shape text not null,
  time_zone text not null,
  starts_on date not null,
  ends_on date not null,
  target bigint,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_code_format check (code ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$'),
  constraint challenges_title_len check (char_length(btrim(title)) between 1 and 60),
  constraint challenges_no_links check (not public.has_web_link(title)),
  constraint challenges_kind check (kind in ('walk')),
  constraint challenges_shape check (shape in ('race', 'together')),
  constraint challenges_time_zone_len check (char_length(time_zone) between 1 and 64),
  constraint challenges_dates check (ends_on >= starts_on),
  constraint challenges_target check (
    (shape = 'race' and target is null)
    or (shape = 'together' and target between 1 and 100000000000)
  ),
  constraint challenges_status check (status in ('active', 'switched_off', 'deleted'))
);

create index challenges_owner_idx on public.challenges (owner_id, created_at desc);

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

create table public.challenge_teams (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  name text not null,
  position smallint not null,
  constraint challenge_teams_name_len check (char_length(btrim(name)) between 1 and 40),
  constraint challenge_teams_no_links check (not public.has_web_link(name)),
  constraint challenge_teams_position check (position between 0 and 3),
  unique (challenge_id, position)
);

create unique index challenge_teams_name_idx
  on public.challenge_teams (challenge_id, lower(name));

-- One row per stretch. Sprint 1 only writes the first stretch. left_on stays empty.
create table public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  team_id uuid not null references public.challenge_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_on date not null,
  left_on date,
  created_at timestamptz not null default now(),
  constraint challenge_members_leave check (left_on is null or left_on >= joined_on)
);

create unique index challenge_members_open_idx
  on public.challenge_members (challenge_id, user_id)
  where left_on is null;

create index challenge_members_user_idx on public.challenge_members (user_id);

-- Misses on unknown codes. The board function writes these. No client access.
create table public.challenge_code_misses (
  id bigint generated always as identity primary key,
  actor text not null,
  created_at timestamptz not null default now()
);

create index challenge_code_misses_actor_idx
  on public.challenge_code_misses (actor, created_at desc);

alter table public.challenges enable row level security;
alter table public.challenge_teams enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_code_misses enable row level security;

create policy "Owners can view own challenges"
  on public.challenges for select using (auth.uid() = owner_id);

create policy "Owners can view own challenge teams"
  on public.challenge_teams for select
  using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.owner_id = auth.uid()
    )
  );

create policy "Members can view own stretches"
  on public.challenge_members for select using (auth.uid() = user_id);

-- Writes go through the functions below. They run as the definer and bypass these policies.

create or replace function public.challenge_actor()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  headers text := current_setting('request.headers', true);
  ip text := '';
begin
  if auth.uid() is not null then
    return auth.uid()::text;
  end if;
  begin
    ip := coalesce(
      headers::json->>'cf-connecting-ip',
      headers::json->>'x-real-ip',
      ''
    );
  exception when others then
    ip := '';
  end;
  if ip <> '' then
    return 'ip:' || left(ip, 64);
  end if;
  return 'anon';
end;
$$;

create or replace function public.challenge_note_miss()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  who text := public.challenge_actor();
  recent int;
  cap int := case when who = 'anon' then 200 else 30 end;
begin
  delete from public.challenge_code_misses where created_at < now() - interval '1 hour';
  select count(*) into recent
  from public.challenge_code_misses
  where actor = who and created_at > now() - interval '10 minutes';
  if recent >= cap then
    raise exception 'challenge_rate_limited' using errcode = 'P0001';
  end if;
  insert into public.challenge_code_misses (actor) values (who);
end;
$$;

create or replace function public.get_challenge_board(p_code text)
returns table (
  challenge_id uuid,
  board_code text,
  title text,
  shape text,
  kind text,
  status text,
  time_zone text,
  starts_on date,
  ends_on date,
  target bigint,
  is_owner boolean,
  my_team_id uuid,
  my_team_name text,
  team_id uuid,
  team_name text,
  member_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  mine uuid;
begin
  if p_code is null or lower(btrim(p_code)) !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' then
    perform public.challenge_note_miss();
    return;
  end if;

  select * into ev from public.challenges c where c.code = lower(btrim(p_code));
  if not found or ev.status = 'deleted' then
    perform public.challenge_note_miss();
    return;
  end if;

  select m.team_id into mine
  from public.challenge_members m
  where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null;

  if ev.status = 'switched_off' then
    challenge_id := ev.id;
    board_code := ev.code;
    title := null;
    shape := ev.shape;
    kind := ev.kind;
    status := ev.status;
    time_zone := ev.time_zone;
    starts_on := ev.starts_on;
    ends_on := ev.ends_on;
    target := null;
    is_owner := auth.uid() = ev.owner_id;
    my_team_id := mine;
    my_team_name := null;
    team_id := null;
    team_name := null;
    member_count := 0;
    return next;
    return;
  end if;

  return query
  select
    ev.id,
    ev.code,
    ev.title,
    ev.shape,
    ev.kind,
    ev.status,
    ev.time_zone,
    ev.starts_on,
    ev.ends_on,
    ev.target,
    auth.uid() = ev.owner_id,
    mine,
    (select tm.name from public.challenge_teams tm where tm.id = mine),
    t.id,
    t.name,
    (
      select count(*)::int
      from public.challenge_members m
      where m.team_id = t.id and m.left_on is null
    )
  from public.challenge_teams t
  where t.challenge_id = ev.id
  order by t.position;
end;
$$;

create or replace function public.create_walking_challenge(
  p_title text,
  p_shape text,
  p_starts_on date,
  p_ends_on date,
  p_target bigint,
  p_team_names text[],
  p_time_zone text,
  p_join boolean,
  p_join_team int,
  p_platform text
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date;
  names text[];
  challenge public.challenges%rowtype;
  team public.challenge_teams%rowtype;
  new_code text;
  i int;
  open_created int;
  open_joined int;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if p_shape not in ('race', 'together') then
    raise exception 'challenge_bad_shape' using errcode = 'P0001';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 60 or public.has_web_link(p_title) then
    raise exception 'challenge_bad_title' using errcode = 'P0001';
  end if;
  if p_time_zone is null or char_length(p_time_zone) not between 1 and 64 then
    raise exception 'challenge_bad_zone' using errcode = 'P0001';
  end if;
  begin
    today := (now() at time zone p_time_zone)::date;
  exception when invalid_parameter_value then
    raise exception 'challenge_bad_zone' using errcode = 'P0001';
  end;
  if p_starts_on is null or p_starts_on < today then
    raise exception 'challenge_past_start' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(n order by ord), '{}')
  into names
  from (
    select ord, regexp_replace(btrim(raw), '\s+', ' ', 'g') as n
    from unnest(coalesce(p_team_names, '{}')) with ordinality as item(raw, ord)
  ) cleaned
  where n <> '';

  if p_shape = 'race' then
    p_ends_on := p_starts_on + 6;
    p_target := null;
    if names is null or cardinality(names) not between 2 and 4 then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
  else
    if p_ends_on is null or (p_ends_on - p_starts_on) not between 6 and 365 then
      raise exception 'challenge_bad_dates' using errcode = 'P0001';
    end if;
    if p_target is null or p_target < 1 or p_target > 100000000000 then
      raise exception 'challenge_bad_target' using errcode = 'P0001';
    end if;
    if names is null or cardinality(names) <> 1 then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
  end if;

  if (select count(distinct lower(n)) from unnest(names) n) <> cardinality(names) then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(names) n where public.has_web_link(n) or char_length(n) > 40) then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;

  select count(*) into open_created
  from public.challenges c
  where c.owner_id = uid
    and c.status = 'active'
    and c.ends_on >= (now() at time zone c.time_zone)::date;
  if open_created >= 5 then
    raise exception 'challenge_creator_cap' using errcode = 'P0001';
  end if;

  if coalesce(p_join, false) then
    if coalesce(p_platform, '') <> 'android' then
      raise exception 'challenge_not_android' using errcode = 'P0001';
    end if;
    select count(distinct m.challenge_id) into open_joined
    from public.challenge_members m
    join public.challenges c on c.id = m.challenge_id
    where m.user_id = uid
      and m.left_on is null
      and c.status = 'active'
      and c.ends_on >= (now() at time zone c.time_zone)::date;
    if open_joined >= 3 then
      raise exception 'challenge_member_cap' using errcode = 'P0001';
    end if;
    if p_shape = 'race' and (p_join_team is null or p_join_team < 0 or p_join_team >= cardinality(names)) then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
  end if;

  for i in 1..5 loop
    new_code := public.challenge_new_code();
    begin
      insert into public.challenges (
        code, owner_id, title, kind, shape, time_zone, starts_on, ends_on, target
      ) values (
        new_code, uid, btrim(p_title), 'walk', p_shape, p_time_zone, p_starts_on, p_ends_on, p_target
      )
      returning * into challenge;
      exit;
    exception when unique_violation then
      if i = 5 then
        raise;
      end if;
    end;
  end loop;

  for i in 1..cardinality(names) loop
    insert into public.challenge_teams (challenge_id, name, position)
    values (challenge.id, names[i], i - 1);
  end loop;

  if coalesce(p_join, false) then
    select * into team
    from public.challenge_teams
    where challenge_id = challenge.id
      and position = case when p_shape = 'together' then 0 else p_join_team end;
    insert into public.challenge_members (challenge_id, team_id, user_id, joined_on)
    values (challenge.id, team.id, uid, greatest(challenge.starts_on, today));
  end if;

  id := challenge.id;
  code := challenge.code;
  return next;
end;
$$;

create or replace function public.join_walking_challenge(
  p_code text,
  p_team_id uuid,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
  team public.challenge_teams%rowtype;
  today date;
  open_joined int;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if coalesce(p_platform, '') <> 'android' then
    raise exception 'challenge_not_android' using errcode = 'P0001';
  end if;

  select * into ev from public.challenges where code = lower(btrim(coalesce(p_code, '')));
  if not found or ev.status = 'deleted' or ev.kind <> 'walk' then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
  if ev.status <> 'active' then
    raise exception 'challenge_switched_off' using errcode = 'P0001';
  end if;

  today := (now() at time zone ev.time_zone)::date;
  if ev.ends_on < today then
    raise exception 'challenge_ended' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id = uid and m.left_on is null
  ) then
    raise exception 'challenge_already_joined' using errcode = 'P0001';
  end if;

  select * into team
  from public.challenge_teams
  where id = p_team_id and challenge_id = ev.id;
  if not found then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;

  select count(distinct m.challenge_id) into open_joined
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = uid
    and m.left_on is null
    and c.status = 'active'
    and c.ends_on >= (now() at time zone c.time_zone)::date;
  if open_joined >= 3 then
    raise exception 'challenge_member_cap' using errcode = 'P0001';
  end if;

  insert into public.challenge_members (challenge_id, team_id, user_id, joined_on)
  values (ev.id, team.id, uid, greatest(ev.starts_on, today));
end;
$$;

create or replace function public.set_walking_challenge_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if p_status not in ('switched_off', 'deleted') then
    raise exception 'challenge_bad_status' using errcode = 'P0001';
  end if;

  select * into ev from public.challenges where id = p_id;
  if not found or ev.owner_id <> uid or ev.status = 'deleted' then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;

  if p_status = 'deleted' and exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id <> uid
  ) then
    raise exception 'challenge_delete_blocked' using errcode = 'P0001';
  end if;

  update public.challenges set status = p_status where id = ev.id;
end;
$$;

revoke all on function public.challenge_actor() from public;
revoke all on function public.challenge_note_miss() from public;
revoke all on function public.challenge_new_code() from public;
revoke all on function public.get_challenge_board(text) from public;
revoke all on function public.create_walking_challenge(text, text, date, date, bigint, text[], text, boolean, int, text) from public;
revoke all on function public.join_walking_challenge(text, uuid, text) from public;
revoke all on function public.set_walking_challenge_status(uuid, text) from public;

grant execute on function public.get_challenge_board(text) to anon, authenticated;
grant execute on function public.create_walking_challenge(text, text, date, date, bigint, text[], text, boolean, int, text) to authenticated;
grant execute on function public.join_walking_challenge(text, uuid, text) to authenticated;
grant execute on function public.set_walking_challenge_status(uuid, text) to authenticated;
