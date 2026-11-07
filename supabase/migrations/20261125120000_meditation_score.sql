begin;

-- Meditation challenges score minutes from the catalog sits.
-- A sitting counts up to 60 minutes. A race day counts up to 60. A shared-goal day counts up to 300.
-- Open days stay on member rows. A team-day row, once one exists, is frozen and is left alone.

alter table public.challenges drop constraint challenges_kind;
alter table public.challenges
  add constraint challenges_kind check (kind in ('walk', 'meditate'));

create or replace function public.rescore_meditation_member_day(p_user uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  raw_minutes int;
  sit_minutes int;
  day_cap int;
begin
  if p_user is null or p_day is null then
    return;
  end if;

  for ev in
    select c.id, c.shape
    from public.challenge_members m
    join public.challenges c on c.id = m.challenge_id
    where m.user_id = p_user
      and m.joined_on <= p_day
      and (m.left_on is null or p_day < m.left_on)
      and c.kind = 'meditate'
      and c.status in ('active', 'switched_off')
      and p_day between c.starts_on and c.ends_on
      and not exists (
        select 1
        from public.challenge_team_days td
        where td.challenge_id = c.id
          and td.team_id = m.team_id
          and td.day = p_day
      )
  loop
    day_cap := case when ev.shape = 'race' then 60 else 300 end;

    select
      coalesce(sum(le.duration_seconds / 60), 0)::int,
      coalesce(sum(least(le.duration_seconds, 3600) / 60), 0)::int
    into raw_minutes, sit_minutes
    from public.log_entries le
    join public.activities a on a.id = le.activity_id
    where le.user_id = p_user
      and le.date = p_day
      and le.type = 'session'
      and le.duration_seconds > 0
      and a.template_id in (
        'meditate',
        'bhastrika',
        'kapalabhati',
        'anuloma_viloma',
        'bhramari',
        'prayer',
        'rejuvenation'
      );

    if raw_minutes <= 0 then
      delete from public.challenge_member_days
      where challenge_id = ev.id and user_id = p_user and day = p_day;
    else
      insert into public.challenge_member_days (challenge_id, user_id, day, raw_steps, capped_steps)
      values (ev.id, p_user, p_day, raw_minutes, least(sit_minutes, day_cap))
      on conflict (challenge_id, user_id, day) do update
      set raw_steps = excluded.raw_steps,
          capped_steps = excluded.capped_steps;
    end if;
  end loop;
end;
$$;

create or replace function public.rescore_meditation_from_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.rescore_meditation_member_day(old.user_id, old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op = 'INSERT'
      or new.date is distinct from old.date
      or new.user_id is distinct from old.user_id
      or new.duration_seconds is distinct from old.duration_seconds
      or new.type is distinct from old.type
      or new.activity_id is distinct from old.activity_id
    then
      perform public.rescore_meditation_member_day(new.user_id, new.date);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_entries_meditation_score on public.log_entries;
create trigger log_entries_meditation_score
  after insert or update or delete on public.log_entries
  for each row
  execute function public.rescore_meditation_from_log();

-- Open meditation days are averaged from member rows. Walking keeps its own function.
alter function public.challenge_scores(uuid) rename to walking_challenge_scores;

create function public.meditation_challenge_scores(p_id uuid)
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
  through date;
  phase text;
  joined int;
  t record;
  d date;
  counted int;
  day_sum bigint;
  pace_sum numeric;
  pace_n int;
  v_total bigint;
  v_day int;
  v_days_left int;
begin
  select * into ev from public.challenges where id = p_id;
  if not found or ev.status = 'deleted' or ev.kind <> 'meditate' then
    return;
  end if;

  perform public.challenge_apply_leaves(ev.id);
  today := (now() at time zone ev.time_zone)::date;

  select count(*)::int into joined
  from public.challenge_members m
  where m.challenge_id = ev.id and m.left_on is null;

  if today < ev.starts_on and ev.status <> 'ended' then
    phase := 'before';
  elsif ev.status = 'ended' or today > ev.ends_on then
    phase := 'final';
  else
    phase := 'so_far';
  end if;

  through := case
    when phase = 'before' then null
    else least(ev.ends_on, today)
  end;
  v_day := case when through is null then null else (through - ev.starts_on) + 1 end;
  v_days_left := case when through is null then null else ev.ends_on - through end;

  for t in
    select * from public.challenge_teams
    where challenge_id = ev.id
    order by position
  loop
    pace_sum := 0;
    pace_n := 0;
    v_total := 0;
    if through is not null then
      d := ev.starts_on;
      while d <= through loop
        select count(*)::int, coalesce(sum(md.capped_steps), 0)
        into counted, day_sum
        from public.challenge_members m
        left join public.challenge_member_days md
          on md.challenge_id = m.challenge_id
         and md.user_id = m.user_id
         and md.day = d
        where m.challenge_id = ev.id
          and m.team_id = t.id
          and m.joined_on <= d
          and (m.left_on is null or d < m.left_on);

        if ev.shape = 'race' and counted >= 3 then
          pace_sum := pace_sum + day_sum::numeric / counted;
          pace_n := pace_n + 1;
        end if;
        if ev.shape = 'together' then
          v_total := v_total + day_sum;
        end if;
        d := d + 1;
      end loop;
    end if;

    team_id := t.id;
    team_name := t.name;
    member_count := (
      select count(*)::int
      from public.challenge_members m
      where m.challenge_id = ev.id and m.team_id = t.id and m.left_on is null
    );
    pace := case
      when ev.shape = 'race' and pace_n > 0 then pace_sum / pace_n
      else null
    end;
    total_steps := case
      when ev.shape = 'together' and joined >= 3 and phase <> 'before' then v_total
      else null
    end;
    day_number := v_day;
    days_left := v_days_left;
    score_phase := phase;
    joined_count := joined;
    if phase = 'final' then
      record_pace := pace;
      record_total := total_steps;
      frozen_day_number := v_day;
      record_days_left := 0;
      open_day := null;
      frozen_day := ev.ends_on;
    else
      record_pace := null;
      record_total := null;
      frozen_day_number := null;
      record_days_left := null;
      open_day := case when phase = 'so_far' then through else null end;
      frozen_day := null;
    end if;
    return next;
  end loop;
end;
$$;

create function public.challenge_scores(p_id uuid)
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
begin
  select * into ev from public.challenges where id = p_id;
  if not found or ev.status = 'deleted' then
    return;
  end if;
  if ev.kind = 'meditate' then
    return query select * from public.meditation_challenge_scores(p_id);
    return;
  end if;
  return query select * from public.walking_challenge_scores(p_id);
end;
$$;

create or replace function public.challenge_day_history(p_code text)
returns table (kind text, team_id uuid, day date, steps int)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  today date;
begin
  if p_code is null or lower(btrim(p_code)) !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' then
    return;
  end if;
  select * into ev from public.challenges c where c.code = lower(btrim(p_code));
  if not found or ev.status = 'deleted' then
    return;
  end if;
  if ev.status = 'switched_off'
     and auth.uid() is distinct from ev.owner_id
     and not exists (
       select 1 from public.challenge_members m
       where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null
     ) then
    return;
  end if;

  if ev.kind = 'meditate' then
    today := (now() at time zone ev.time_zone)::date;
    return query
    select
      'team'::text,
      m.team_id,
      d.day,
      case
        when ev.shape = 'together' then sum(coalesce(md.capped_steps, 0))::int
        else (sum(coalesce(md.capped_steps, 0)) / count(*))::int
      end
    from (
      select generate_series(
        ev.starts_on,
        least(ev.ends_on, today),
        interval '1 day'
      )::date as day
    ) d
    join public.challenge_members m
      on m.challenge_id = ev.id
     and m.joined_on <= d.day
     and (m.left_on is null or d.day < m.left_on)
    left join public.challenge_member_days md
      on md.challenge_id = ev.id
     and md.user_id = m.user_id
     and md.day = d.day
    where today >= ev.starts_on
    group by m.team_id, d.day
    having count(*) >= 3
    order by d.day, m.team_id;
  else
    return query
    select
      'team'::text,
      td.team_id,
      td.day,
      (round(td.capped_sum::numeric / td.member_count / 100) * 100)::int
    from public.challenge_team_days td
    where td.challenge_id = ev.id
      and td.member_count > 0
    order by td.day, td.team_id;
  end if;

  return query
  select 'mine'::text, null::uuid, md.day, md.raw_steps
  from public.challenge_member_days md
  where md.challenge_id = ev.id
    and md.user_id = auth.uid()
  order by md.day;
end;
$$;

create or replace function public.my_challenge_index()
returns table (role text, code text, title text, card_path text)
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
  select 'member'::text, c.code, c.title, c.photo_path
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = uid
    and m.left_on is null
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind in ('walk', 'meditate')
  order by c.created_at
  limit 3;

  return query
  select 'run'::text, c.code, c.title, c.photo_path
  from public.challenges c
  where c.owner_id = uid
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind in ('walk', 'meditate')
    and not exists (
      select 1 from public.challenge_members m
      where m.challenge_id = c.id and m.user_id = uid and m.left_on is null
    )
  order by c.created_at;
end;
$$;

create or replace function public.set_challenge_team_images(p_id uuid, p_images int[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
  i int;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenges c
    where c.id = p_id and c.owner_id = uid and c.kind in ('walk', 'meditate') and c.status <> 'deleted'
  ) then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  select count(*)::int into n from public.challenge_teams where challenge_id = p_id;
  if p_images is null or cardinality(p_images) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(p_images) v where v is null or v < 1 or v > 4) then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  for i in 1..n loop
    update public.challenge_teams
    set image = p_images[i]
    where challenge_id = p_id and position = i - 1;
  end loop;
end;
$$;

create or replace function public.set_challenge_photos(
  p_id uuid,
  p_card text default null,
  p_team_paths text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
  i int;
  path text;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenges c
    where c.id = p_id and c.owner_id = uid and c.kind in ('walk', 'meditate') and c.status <> 'deleted'
  ) then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;

  if p_card is not null and p_card <> '' then
    if p_card !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
    update public.challenges set photo_path = p_card where id = p_id;
  end if;

  if p_team_paths is null then
    return;
  end if;
  select count(*)::int into n from public.challenge_teams where challenge_id = p_id;
  if cardinality(p_team_paths) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  for i in 1..n loop
    path := p_team_paths[i];
    if path is null or path = '' then
      continue;
    end if;
    if path !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
    update public.challenge_teams
    set photo_path = path
    where challenge_id = p_id and position = i - 1;
  end loop;
end;
$$;

drop function public.create_walking_challenge(text, text, date, date, bigint, text[], text, boolean, int, text);

create function public.create_walking_challenge(
  p_title text,
  p_shape text,
  p_starts_on date,
  p_ends_on date,
  p_target bigint,
  p_team_names text[],
  p_time_zone text,
  p_join boolean,
  p_join_team int,
  p_platform text,
  p_kind text default 'walk'
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
  kind text := coalesce(p_kind, 'walk');
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if kind not in ('walk', 'meditate') or p_shape not in ('race', 'together') then
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
    if kind = 'walk' and coalesce(p_platform, '') <> 'android' then
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
        new_code, uid, btrim(p_title), kind, p_shape, p_time_zone, p_starts_on, p_ends_on, p_target
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
    if kind = 'meditate' and greatest(challenge.starts_on, today) <= today then
      perform public.rescore_meditation_member_day(uid, greatest(challenge.starts_on, today));
    end if;
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
  joined_on date;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;

  select * into ev from public.challenges where code = lower(btrim(coalesce(p_code, '')));
  if not found or ev.status = 'deleted' or ev.kind not in ('walk', 'meditate') then
    raise exception 'challenge_unavailable' using errcode = 'P0001';
  end if;
  if ev.kind = 'walk' and coalesce(p_platform, '') <> 'android' then
    raise exception 'challenge_not_android' using errcode = 'P0001';
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

  joined_on := greatest(ev.starts_on, today);
  insert into public.challenge_members (challenge_id, team_id, user_id, joined_on)
  values (ev.id, team.id, uid, joined_on);
  if ev.kind = 'meditate' and joined_on <= today then
    perform public.rescore_meditation_member_day(uid, joined_on);
  end if;
end;
$$;

revoke all on function public.rescore_meditation_member_day(uuid, date) from public;
revoke all on function public.rescore_meditation_from_log() from public;
revoke all on function public.meditation_challenge_scores(uuid) from public;
revoke all on function public.challenge_scores(uuid) from public;
revoke all on function public.walking_challenge_scores(uuid) from public;
revoke all on function public.create_walking_challenge(text, text, date, date, bigint, text[], text, boolean, int, text, text) from public;

grant execute on function public.create_walking_challenge(text, text, date, date, bigint, text[], text, boolean, int, text, text) to authenticated;

commit;
