-- Leaving a race is final. A shared goal comes back on the same team.
-- A meditation day locks at 9:00 the next morning on the challenge clock,
-- or when that date has ended for every member who counted, whichever is later.

begin;

create or replace function public.freeze_meditation_challenge(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  d date;
  challenge_at timestamptz;
  member_close timestamptz;
  freeze_at timestamptz;
begin
  select * into ev from public.challenges where id = p_id for update;
  if not found or ev.kind <> 'meditate' or ev.status not in ('active', 'switched_off') then
    return;
  end if;
  perform public.challenge_apply_leaves(ev.id);

  d := ev.starts_on;
  while d <= ev.ends_on loop
    challenge_at := ((d + 1)::timestamp + time '09:00') at time zone ev.time_zone;
    select max(
      ((d + 1)::timestamp) at time zone coalesce(nullif(btrim(p.timezone), ''), ev.time_zone)
    )
    into member_close
    from public.challenge_members m
    left join public.profiles p on p.id = m.user_id
    where m.challenge_id = ev.id
      and m.joined_on <= d
      and (m.left_on is null or d < m.left_on);

    freeze_at := greatest(challenge_at, coalesce(member_close, challenge_at));
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

create or replace function public.freeze_due_meditation_challenges()
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
    where kind = 'meditate' and status in ('active', 'switched_off')
  loop
    perform public.freeze_meditation_challenge(cid);
  end loop;
end;
$$;

create or replace function public.meditation_challenge_scores(p_id uuid)
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
  if not found or ev.status = 'deleted' or ev.kind <> 'meditate' then
    return;
  end if;
  perform public.challenge_apply_leaves(ev.id);
  if ev.status in ('active', 'switched_off') then
    perform public.freeze_meditation_challenge(ev.id);
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
  if ev.kind = 'meditate' then
    perform public.freeze_meditation_challenge(ev.id);
  else
    perform public.freeze_walking_challenge(ev.id);
  end if;
  update public.challenges
  set status = 'ended',
      ended_on = (now() at time zone ev.time_zone)::date
  where id = ev.id;
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
  previous uuid;
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

  today := (now() at time zone ev.time_zone)::date;
  if ev.status = 'ended' or ev.ends_on < today then
    raise exception 'challenge_ended' using errcode = 'P0001';
  end if;
  if ev.status <> 'active' then
    raise exception 'challenge_switched_off' using errcode = 'P0001';
  end if;

  perform public.challenge_apply_leaves(ev.id);

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
  if open_joined >= 5 then
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

revoke all on function public.freeze_meditation_challenge(uuid) from public;
revoke all on function public.freeze_due_meditation_challenges() from public;
revoke all on function public.meditation_challenge_scores(uuid) from public;
revoke all on function public.end_walking_challenge(uuid) from public;
revoke all on function public.join_walking_challenge(text, uuid, text) from public;

grant execute on function public.end_walking_challenge(uuid) to authenticated;
grant execute on function public.join_walking_challenge(text, uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'resuming-meditation-freeze',
      '*/15 * * * *',
      'select public.freeze_due_meditation_challenges()'
    );
  end if;
end;
$$;

commit;
