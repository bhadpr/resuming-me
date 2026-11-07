-- Phase 1, sprints 2–4: a live walking score, a 9:00 freeze, and leave / end.
-- The group sees team numbers only. A person writes raw steps; the server caps them.

alter table public.challenges drop constraint challenges_status;
alter table public.challenges
  add constraint challenges_status
  check (status in ('active', 'switched_off', 'deleted', 'ended'));

alter table public.challenge_members
  add column leaving_on date,
  add constraint challenge_members_leaving
    check (leaving_on is null or (left_on is null and leaving_on >= joined_on));

-- One raw total per member per challenge day. capped_steps is server-written.
create table public.challenge_member_days (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  raw_steps integer not null check (raw_steps >= 0),
  capped_steps integer not null check (capped_steps >= 0 and capped_steps <= 10000),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day)
);

alter table public.challenge_member_days enable row level security;

create policy "Members can view own walking days"
  on public.challenge_member_days for select
  using (auth.uid() = user_id);

-- Saved when the day freezes. The board reads these and recomputes only the open day.
create table public.challenge_team_days (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  team_id uuid not null references public.challenge_teams (id) on delete cascade,
  day date not null,
  capped_sum bigint not null,
  member_count integer not null,
  primary key (challenge_id, team_id, day)
);

alter table public.challenge_team_days enable row level security;

-- The morning card stays on Today until this person shares that frozen day.
create table public.challenge_card_shares (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shared_through date not null,
  primary key (challenge_id, user_id)
);

alter table public.challenge_card_shares enable row level security;

create or replace function public.challenge_apply_leaves(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date;
begin
  select (now() at time zone c.time_zone)::date into today
  from public.challenges c where c.id = p_id;
  if today is null then
    return;
  end if;
  update public.challenge_members
  set left_on = leaving_on, leaving_on = null
  where challenge_id = p_id
    and left_on is null
    and leaving_on is not null
    and leaving_on <= today;
end;
$$;

create or replace function public.freeze_walking_challenge(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  d date;
  freeze_at timestamptz;
begin
  select * into ev from public.challenges where id = p_id for update;
  if not found or ev.kind <> 'walk' or ev.status not in ('active', 'switched_off') then
    return;
  end if;
  perform public.challenge_apply_leaves(ev.id);
  d := ev.starts_on;
  while d <= ev.ends_on loop
    freeze_at := ((d + 1)::timestamp + time '09:00') at time zone ev.time_zone;
    exit when freeze_at > now();
    if not exists (
      select 1 from public.challenge_team_days td
      where td.challenge_id = ev.id and td.day = d
    ) then
      insert into public.challenge_team_days (challenge_id, team_id, day, capped_sum, member_count)
      select
        ev.id,
        t.id,
        d,
        coalesce((
          select sum(md.capped_steps)
          from public.challenge_member_days md
          where md.challenge_id = ev.id
            and md.day = d
            and exists (
              select 1 from public.challenge_members m
              where m.challenge_id = ev.id
                and m.user_id = md.user_id
                and m.team_id = t.id
                and m.joined_on <= d
                and (m.left_on is null or d < m.left_on)
            )
        ), 0),
        (
          select count(*)::int
          from public.challenge_members m
          where m.challenge_id = ev.id
            and m.team_id = t.id
            and m.joined_on <= d
            and (m.left_on is null or d < m.left_on)
        )
      from public.challenge_teams t
      where t.challenge_id = ev.id;
    end if;
    d := d + 1;
  end loop;
end;
$$;

create or replace function public.freeze_due_walking_challenges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  for cid in
    select id from public.challenges
    where kind = 'walk' and status in ('active', 'switched_off')
  loop
    perform public.freeze_walking_challenge(cid);
  end loop;
end;
$$;

-- Team standings for one challenge. pace includes the open day. record_pace does not.
create or replace function public.challenge_scores(p_id uuid)
returns table (
  team_id uuid,
  team_name text,
  member_count int,
  pace numeric,
  record_pace numeric,
  total_steps bigint,
  record_total bigint,
  day_number int,
  frozen_day_number int,
  days_left int,
  record_days_left int,
  score_phase text,
  joined_count int,
  open_day date,
  frozen_day date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  today date;
  v_open date;
  v_frozen date;
  phase text;
  joined int;
  t record;
  drec record;
  live_count int;
  live_sum bigint;
  pace_sum numeric;
  pace_n int;
  record_sum numeric;
  record_n int;
  v_total bigint;
  v_record bigint;
  v_day int;
  v_frozen_number int;
  v_days_left int;
  v_record_days int;
  report_day date;
begin
  select * into ev from public.challenges where id = p_id;
  if not found or ev.status = 'deleted' or ev.kind <> 'walk' then
    return;
  end if;
  perform public.challenge_apply_leaves(ev.id);
  if ev.status in ('active', 'switched_off') then
    perform public.freeze_walking_challenge(ev.id);
  end if;

  today := (now() at time zone ev.time_zone)::date;
  select max(td.day) into v_frozen
  from public.challenge_team_days td where td.challenge_id = ev.id;

  v_open := null;
  if ev.status = 'active' and today >= ev.starts_on then
    select max(g.day) into v_open
    from (
      select generate_series(ev.starts_on, least(ev.ends_on, today), interval '1 day')::date as day
    ) g
    where not exists (
      select 1 from public.challenge_team_days td
      where td.challenge_id = ev.id and td.day = g.day
    );
  end if;

  if today < ev.starts_on and ev.status <> 'ended' then
    phase := 'before';
  elsif ev.status = 'ended' or (v_open is null and v_frozen is not null and v_frozen = ev.ends_on) then
    phase := 'final';
  elsif v_open is null and v_frozen is not null then
    phase := 'morning';
  elsif v_open is null then
    phase := 'before';
  else
    phase := 'so_far';
  end if;

  select count(*)::int into joined
  from public.challenge_members m
  where m.challenge_id = ev.id and m.left_on is null;

  v_record := null;
  v_total := null;
  if ev.shape = 'together' and joined >= 3 and phase <> 'before' then
    select sum(td.capped_sum) into v_record
    from public.challenge_team_days td where td.challenge_id = ev.id;
    live_sum := 0;
    if v_open is not null then
      select coalesce(sum(md.capped_steps), 0) into live_sum
      from public.challenge_member_days md
      where md.challenge_id = ev.id and md.day = v_open;
    end if;
    v_total := coalesce(v_record, 0) + live_sum;
  end if;

  report_day := case when phase = 'so_far' then v_open else v_frozen end;
  v_day := case when report_day is null then null else (report_day - ev.starts_on) + 1 end;
  v_frozen_number := case when v_frozen is null then null else (v_frozen - ev.starts_on) + 1 end;
  v_days_left := case when report_day is null then null else ev.ends_on - report_day end;
  v_record_days := case when v_frozen is null then null else ev.ends_on - v_frozen end;

  for t in
    select * from public.challenge_teams
    where challenge_id = ev.id
    order by position
  loop
    record_sum := 0;
    record_n := 0;
    for drec in
      select td.capped_sum, td.member_count
      from public.challenge_team_days td
      where td.challenge_id = ev.id and td.team_id = t.id and td.member_count >= 3
    loop
      record_sum := record_sum + drec.capped_sum::numeric / drec.member_count;
      record_n := record_n + 1;
    end loop;

    pace_sum := record_sum;
    pace_n := record_n;
    if v_open is not null and ev.shape = 'race' then
      select count(*)::int into live_count
      from public.challenge_members m
      where m.challenge_id = ev.id
        and m.team_id = t.id
        and m.joined_on <= v_open
        and (m.left_on is null or v_open < m.left_on);
      if live_count >= 3 then
        select coalesce(sum(md.capped_steps), 0) into live_sum
        from public.challenge_member_days md
        where md.challenge_id = ev.id
          and md.day = v_open
          and exists (
            select 1 from public.challenge_members m
            where m.challenge_id = ev.id
              and m.user_id = md.user_id
              and m.team_id = t.id
              and m.joined_on <= v_open
              and (m.left_on is null or v_open < m.left_on)
          );
        pace_sum := pace_sum + live_sum::numeric / live_count;
        pace_n := pace_n + 1;
      end if;
    end if;

    team_id := t.id;
    team_name := t.name;
    member_count := (
      select count(*)::int from public.challenge_members m
      where m.challenge_id = ev.id and m.team_id = t.id and m.left_on is null
    );
    pace := case when ev.shape = 'race' and pace_n > 0 then pace_sum / pace_n else null end;
    record_pace := case when ev.shape = 'race' and record_n > 0 then record_sum / record_n else null end;
    total_steps := v_total;
    record_total := v_record;
    day_number := v_day;
    frozen_day_number := v_frozen_number;
    days_left := v_days_left;
    record_days_left := v_record_days;
    score_phase := phase;
    joined_count := joined;
    open_day := v_open;
    frozen_day := v_frozen;
    return next;
  end loop;
end;
$$;

drop function public.get_challenge_board(text);

create function public.get_challenge_board(p_code text)
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
  member_count int,
  pace numeric,
  record_pace numeric,
  total_steps bigint,
  record_total bigint,
  day_number int,
  frozen_day_number int,
  days_left int,
  record_days_left int,
  score_phase text,
  joined_count int,
  card_ready boolean,
  my_raw int,
  my_capped int,
  my_day_closed boolean,
  my_leaving_on date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  mine uuid;
  personal date;
  shared date;
  latest date;
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

  perform public.challenge_apply_leaves(ev.id);

  select m.team_id into mine
  from public.challenge_members m
  where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null;

  if ev.status = 'switched_off'
     and auth.uid() is distinct from ev.owner_id
     and mine is null then
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
    is_owner := false;
    my_team_id := null;
    my_team_name := null;
    team_id := null;
    team_name := null;
    member_count := 0;
    pace := null;
    record_pace := null;
    total_steps := null;
    record_total := null;
    day_number := null;
    frozen_day_number := null;
    days_left := null;
    record_days_left := null;
    score_phase := null;
    joined_count := 0;
    card_ready := false;
    my_raw := null;
    my_capped := null;
    my_day_closed := false;
    my_leaving_on := null;
    return next;
    return;
  end if;

  select max(s.frozen_day) into latest from public.challenge_scores(ev.id) s;
  select cs.shared_through into shared
  from public.challenge_card_shares cs
  where cs.challenge_id = ev.id and cs.user_id = auth.uid();

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
    s.team_id,
    s.team_name,
    s.member_count,
    s.pace,
    s.record_pace,
    s.total_steps,
    s.record_total,
    s.day_number,
    s.frozen_day_number,
    s.days_left,
    s.record_days_left,
    s.score_phase,
    s.joined_count,
    latest is not null and (shared is null or shared < latest),
    (
      select md.raw_steps
      from public.challenge_member_days md
      where md.challenge_id = ev.id
        and md.user_id = auth.uid()
        and md.day = coalesce(s.open_day, s.frozen_day)
    ),
    (
      select md.capped_steps
      from public.challenge_member_days md
      where md.challenge_id = ev.id
        and md.user_id = auth.uid()
        and md.day = coalesce(s.open_day, s.frozen_day)
    ),
    s.open_day is null and s.frozen_day is not null and mine is not null,
    (
      select m.leaving_on
      from public.challenge_members m
      where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null
      limit 1
    )
  from public.challenge_scores(ev.id) s;
end;
$$;

create or replace function public.save_walking_steps(p_code text, p_days jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
  today date;
  item jsonb;
  d date;
  raw int;
  capped int;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  select * into ev from public.challenges where code = lower(btrim(coalesce(p_code, '')));
  if not found or ev.kind <> 'walk' or ev.status in ('deleted', 'ended') then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
  perform public.challenge_apply_leaves(ev.id);
  perform public.freeze_walking_challenge(ev.id);
  today := (now() at time zone ev.time_zone)::date;

  if not exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id = uid and m.left_on is null
  ) then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_days, '[]'::jsonb))
  loop
    d := (item->>'day')::date;
    raw := (item->>'raw')::int;
    if d is null or raw is null or raw < 0 or raw > 2000000000 then
      continue;
    end if;
    if d < ev.starts_on or d > ev.ends_on or d > today then
      continue;
    end if;
    if exists (
      select 1 from public.challenge_team_days td
      where td.challenge_id = ev.id and td.day = d
    ) then
      continue;
    end if;
    if not exists (
      select 1 from public.challenge_members m
      where m.challenge_id = ev.id
        and m.user_id = uid
        and m.joined_on <= d
        and (m.left_on is null or d < m.left_on)
    ) then
      continue;
    end if;
    capped := least(raw, 10000);
    insert into public.challenge_member_days (challenge_id, user_id, day, raw_steps, capped_steps)
    values (ev.id, uid, d, raw, capped)
    on conflict (challenge_id, user_id, day)
    do update set raw_steps = excluded.raw_steps, capped_steps = excluded.capped_steps, updated_at = now();
  end loop;
end;
$$;

create or replace function public.walking_sync_days()
returns table (code text, time_zone text, day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev record;
  today date;
  d date;
begin
  if uid is null then
    return;
  end if;
  for ev in
    select c.*
    from public.challenges c
    join public.challenge_members m on m.challenge_id = c.id and m.user_id = uid and m.left_on is null
    where c.kind = 'walk' and c.status in ('active', 'switched_off')
  loop
    perform public.freeze_walking_challenge(ev.id);
    today := (now() at time zone ev.time_zone)::date;
    d := ev.starts_on;
    while d <= least(ev.ends_on, today) loop
      if not exists (
        select 1 from public.challenge_team_days td
        where td.challenge_id = ev.id and td.day = d
      ) and exists (
        select 1 from public.challenge_members m
        where m.challenge_id = ev.id
          and m.user_id = uid
          and m.joined_on <= d
          and (m.left_on is null or d < m.left_on)
      ) then
        code := ev.code;
        time_zone := ev.time_zone;
        day := d;
        return next;
      end if;
      d := d + 1;
    end loop;
  end loop;
end;
$$;

create or replace function public.my_challenge_index()
returns table (role text, code text, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  return query
  select 'member'::text, c.code, c.title
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = uid
    and m.left_on is null
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind = 'walk'
  order by c.created_at
  limit 3;

  return query
  select 'run'::text, c.code, c.title
  from public.challenges c
  where c.owner_id = uid
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind = 'walk'
    and not exists (
      select 1 from public.challenge_members m
      where m.challenge_id = c.id and m.user_id = uid and m.left_on is null
    )
  order by c.created_at;
end;
$$;

create or replace function public.schedule_challenge_leave(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
  today date;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  select * into ev from public.challenges where id = p_id;
  if not found or ev.status not in ('active', 'switched_off') then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
  perform public.challenge_apply_leaves(ev.id);
  today := (now() at time zone ev.time_zone)::date;
  update public.challenge_members
  set leaving_on = today + 1
  where challenge_id = ev.id and user_id = uid and left_on is null and leaving_on is null;
  if not found then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.cancel_challenge_leave(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  update public.challenge_members m
  set leaving_on = null
  from public.challenges c
  where m.challenge_id = p_id
    and c.id = m.challenge_id
    and m.user_id = uid
    and m.left_on is null
    and m.leaving_on is not null
    and m.leaving_on > (now() at time zone c.time_zone)::date;
  if not found then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.end_walking_challenge(p_id uuid)
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
  select * into ev from public.challenges where id = p_id;
  if not found or ev.owner_id <> uid or ev.status <> 'active' then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id <> uid
  ) then
    raise exception 'challenge_end_blocked' using errcode = 'P0001';
  end if;
  perform public.freeze_walking_challenge(ev.id);
  update public.challenges set status = 'ended' where id = ev.id;
end;
$$;

create or replace function public.mark_challenge_shared(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  latest date;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenges c
    where c.id = p_id and (c.owner_id = uid or exists (
      select 1 from public.challenge_members m
      where m.challenge_id = c.id and m.user_id = uid
    ))
  ) then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  select max(day) into latest from public.challenge_team_days where challenge_id = p_id;
  if latest is null then
    return;
  end if;
  insert into public.challenge_card_shares (challenge_id, user_id, shared_through)
  values (p_id, uid, latest)
  on conflict (challenge_id, user_id)
  do update set shared_through = excluded.shared_through;
end;
$$;

-- Join: a race cannot be rejoined. A shared goal comes back on the same team.
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
  previous uuid;
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
  if ev.status = 'ended' or ev.ends_on < (now() at time zone ev.time_zone)::date then
    raise exception 'challenge_ended' using errcode = 'P0001';
  end if;
  if ev.status <> 'active' then
    raise exception 'challenge_switched_off' using errcode = 'P0001';
  end if;

  perform public.challenge_apply_leaves(ev.id);
  today := (now() at time zone ev.time_zone)::date;

  if exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id = uid and m.left_on is null
  ) then
    raise exception 'challenge_already_joined' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id = uid
  ) then
    if ev.shape = 'race' then
      raise exception 'challenge_race_closed' using errcode = 'P0001';
    end if;
    select m.team_id into previous
    from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id = uid
    order by m.joined_on desc
    limit 1;
    select * into team from public.challenge_teams where id = previous;
  else
    select * into team
    from public.challenge_teams
    where id = p_team_id and challenge_id = ev.id;
  end if;
  if team.id is null then
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

revoke all on function public.challenge_apply_leaves(uuid) from public;
revoke all on function public.freeze_walking_challenge(uuid) from public;
revoke all on function public.freeze_due_walking_challenges() from public;
revoke all on function public.challenge_scores(uuid) from public;
revoke all on function public.get_challenge_board(text) from public;
revoke all on function public.save_walking_steps(text, jsonb) from public;
revoke all on function public.walking_sync_days() from public;
revoke all on function public.my_challenge_index() from public;
revoke all on function public.schedule_challenge_leave(uuid) from public;
revoke all on function public.cancel_challenge_leave(uuid) from public;
revoke all on function public.end_walking_challenge(uuid) from public;
revoke all on function public.mark_challenge_shared(uuid) from public;

grant execute on function public.get_challenge_board(text) to anon, authenticated;
grant execute on function public.save_walking_steps(text, jsonb) to authenticated;
grant execute on function public.walking_sync_days() to authenticated;
grant execute on function public.my_challenge_index() to authenticated;
grant execute on function public.schedule_challenge_leave(uuid) to authenticated;
grant execute on function public.cancel_challenge_leave(uuid) to authenticated;
grant execute on function public.end_walking_challenge(uuid) to authenticated;
grant execute on function public.mark_challenge_shared(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'resuming-walking-freeze',
      '*/15 * * * *',
      'select public.freeze_due_walking_challenges()'
    );
  end if;
end;
$$;
