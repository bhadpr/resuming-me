-- Growth metrics for the founder / investor "track record" view, plus a permanent monthly history.
--
-- Everything is counted from the first-party `events` table, in the database. No new events are
-- needed: the names the app already sends map onto the usual growth names.
--
--   signed_up                  = signup_completed
--   onboarding_started/finished = onboarding_started, then a signup_completed from the same device
--   habit_created              = activity_created
--   habit_checked_in           = log_created
--   day_missed / habit_resumed = worked out from the days a person checked in (see "slips" below),
--                                because a missed day leaves no event to send
--
-- Definitions (all days are UTC days; only signed-in people are counted, as in the other
-- admin analytics):
--   active          opened the app or checked in that day
--   D1 / D7 / D30   was active on exactly 1 / 7 / 30 days after the signup day. A person only
--                   counts once that day is over.
--   DAU / MAU       over the last 30 finished days. Stickiness = average DAU / MAU.
--   slip            a day with a check-in, followed by a day with none
--   resume rate     the share of slips that were followed by another check-in within 7 days.
--                   A slip counts only once those 7 days are over. Measured per account: a person
--                   with several habits who skips only one of them is not a slip.
--
-- Events are deleted after 13 months (data retention), so `growth_snapshots` keeps a small,
-- aggregate-only copy of these numbers on the 1st of every month. It holds counts and rates, no
-- person, device or habit text, and the retention job never touches it.

create or replace function public.compute_growth_metrics(p_weeks integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_weeks integer := greatest(1, least(coalesce(p_weeks, 12), 52));
  v_today date := (now() at time zone 'utc')::date;
  v_first_week date;
  v_from_day date;
  v_from_ts timestamptz;
  v_result jsonb;
begin
  v_first_week := date_trunc('week', v_today::timestamp)::date - (v_weeks - 1) * 7;
  -- One day before the first week, so a check-in the day before can still start a slip, and
  -- always at least 30 days back for DAU / MAU.
  v_from_day := least(v_first_week - 1, v_today - 30);
  v_from_ts := v_from_day::timestamp at time zone 'utc';

  with ev as (
    select
      name, user_id, anon_id, platform, props, created_at,
      (created_at at time zone 'utc')::date as day
    from public.events
    where created_at >= v_from_ts
      and name in ('app_opened', 'log_created', 'signup_completed', 'onboarding_started')
  ),
  active_days as (
    select distinct user_id, day
    from ev
    where user_id is not null and name in ('app_opened', 'log_created')
  ),
  check_days as (
    select distinct user_id, day
    from ev
    where user_id is not null and name = 'log_created'
  ),
  check_events as (
    select day from ev where user_id is not null and name = 'log_created'
  ),
  signups as (
    select distinct on (user_id)
      user_id, anon_id, platform,
      day as signup_day,
      date_trunc('week', day::timestamp)::date as week_start
    from ev
    where name = 'signup_completed' and user_id is not null and day >= v_first_week
    order by user_id, created_at
  ),
  first_touch as (
    select distinct on (e.anon_id)
      e.anon_id,
      coalesce(
        nullif(e.props ->> 'utm_source', ''),
        nullif(
          regexp_replace(
            coalesce(substring(e.props ->> 'referrer' from '^https?://([^/:?#]+)'), ''),
            '^www\.', ''
          ),
          ''
        ),
        'direct'
      ) as source
    from public.events e
    where e.name = 'landing_viewed'
      and e.anon_id in (select anon_id from signups)
    order by e.anon_id, e.created_at
  ),
  signup_src as (
    select
      s.user_id, s.signup_day, s.week_start,
      coalesce(
        t.source,
        case when s.platform in ('android', 'ios') then s.platform || ' app' else 'web direct' end
      ) as source
    from signups s
    left join first_touch t on t.anon_id = s.anon_id
  ),
  flags as (
    select
      m.week_start,
      m.signup_day + 1 < v_today as el1,
      m.signup_day + 7 < v_today as el7,
      m.signup_day + 30 < v_today as el30,
      exists (select 1 from active_days a where a.user_id = m.user_id and a.day = m.signup_day + 1) as r1,
      exists (select 1 from active_days a where a.user_id = m.user_id and a.day = m.signup_day + 7) as r7,
      exists (select 1 from active_days a where a.user_id = m.user_id and a.day = m.signup_day + 30) as r30
    from signup_src m
  ),
  onb as (
    select
      o.anon_id,
      date_trunc('week', (o.started_at at time zone 'utc')::date::timestamp)::date as week_start,
      exists (
        select 1 from ev e
        where e.name = 'signup_completed' and e.anon_id = o.anon_id and e.created_at >= o.started_at
      ) as finished
    from (
      select anon_id, min(created_at) as started_at
      from ev
      where name = 'onboarding_started' and day >= v_first_week
      group by anon_id
    ) o
  ),
  gaps as (
    select
      user_id, day as last_day,
      lead(day) over (partition by user_id order by day) as next_day
    from check_days
  ),
  slips as (
    select
      date_trunc('week', (last_day + 1)::timestamp)::date as week_start,
      next_day is not null and next_day <= last_day + 8 as resumed
    from gaps
    where (next_day is null or next_day > last_day + 1)
      and last_day + 1 >= v_first_week
      and last_day + 8 < v_today
  ),
  weeks as (
    select g::date as week_start
    from generate_series(v_first_week::timestamp, date_trunc('week', v_today::timestamp), interval '7 days') g
  ),
  window_30 as (
    select user_id, day from active_days where day between v_today - 30 and v_today - 1
  ),
  window_28 as (
    select user_id, day from active_days where day between v_today - 28 and v_today - 1
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'weeks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekStart', w.week_start,
          'signups', (select count(*) from signup_src s where s.week_start = w.week_start),
          'sources', coalesce((
            select jsonb_object_agg(x.source, x.n)
            from (
              select s.source, count(*) as n
              from signup_src s
              where s.week_start = w.week_start
              group by s.source
            ) x
          ), '{}'::jsonb),
          'activeUsers', (
            select count(distinct a.user_id) from active_days a
            where a.day between w.week_start and w.week_start + 6
          ),
          'checkIns', (
            select count(*) from check_events c where c.day between w.week_start and w.week_start + 6
          ),
          'onboardingStarted', (select count(*) from onb o where o.week_start = w.week_start),
          'onboardingFinished', (select count(*) from onb o where o.week_start = w.week_start and o.finished),
          'slips', (select count(*) from slips p where p.week_start = w.week_start),
          'resumed', (select count(*) from slips p where p.week_start = w.week_start and p.resumed)
        )
        order by w.week_start
      )
      from weeks w
    ), '[]'::jsonb),
    'cohorts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekStart', c.week_start,
          'size', c.size,
          'd1', case when c.e1 = 0 then null else round(c.r1::numeric / c.e1, 4) end,
          'd7', case when c.e7 = 0 then null else round(c.r7::numeric / c.e7, 4) end,
          'd30', case when c.e30 = 0 then null else round(c.r30::numeric / c.e30, 4) end
        )
        order by c.week_start
      )
      from (
        select
          week_start,
          count(*) as size,
          count(*) filter (where el1) as e1,
          count(*) filter (where el1 and r1) as r1,
          count(*) filter (where el7) as e7,
          count(*) filter (where el7 and r7) as r7,
          count(*) filter (where el30) as e30,
          count(*) filter (where el30 and r30) as r30
        from flags
        group by week_start
      ) c
    ), '[]'::jsonb),
    'headline', jsonb_build_object(
      'signups', (select count(*) from signup_src),
      'd1', (
        select case when count(*) filter (where el1) = 0 then null
          else round((count(*) filter (where el1 and r1))::numeric / count(*) filter (where el1), 4) end
        from flags
      ),
      'd7', (
        select case when count(*) filter (where el7) = 0 then null
          else round((count(*) filter (where el7 and r7))::numeric / count(*) filter (where el7), 4) end
        from flags
      ),
      'd30', (
        select case when count(*) filter (where el30) = 0 then null
          else round((count(*) filter (where el30 and r30))::numeric / count(*) filter (where el30), 4) end
        from flags
      ),
      'dauYesterday', (select count(*) from active_days where day = v_today - 1),
      'mau', (select count(distinct user_id) from window_30),
      'avgDau', (select round(count(*)::numeric / 30, 2) from window_30),
      'stickiness', (
        select case when count(distinct user_id) = 0 then null
          else round((count(*)::numeric / 30) / count(distinct user_id), 4) end
        from window_30
      ),
      'onboardingStarted', (select count(*) from onb),
      'onboardingFinished', (select count(*) from onb where finished),
      'onboardingCompletion', (
        select case when count(*) = 0 then null
          else round((count(*) filter (where finished))::numeric / count(*), 4) end
        from onb
      ),
      'checkInsPerActiveUserPerWeek', (
        select case when (select count(distinct user_id) from window_28) = 0 then null
          else round(
            (select count(*) from check_events where day between v_today - 28 and v_today - 1)::numeric
            / (select count(distinct user_id) from window_28) / 4,
            2
          ) end
      ),
      'slips', (select count(*) from slips),
      'resumed', (select count(*) from slips where resumed),
      'resumeRate', (
        select case when count(*) = 0 then null
          else round((count(*) filter (where resumed))::numeric / count(*), 4) end
        from slips
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.compute_growth_metrics(integer) from public, anon, authenticated;
grant execute on function public.compute_growth_metrics(integer) to service_role;

-- Admin view: the last p_weeks weeks (1 to 52).
create or replace function public.growth_metrics_summary(p_weeks integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  return public.compute_growth_metrics(p_weeks);
end;
$$;

revoke all on function public.growth_metrics_summary(integer) from public, anon;
grant execute on function public.growth_metrics_summary(integer) to authenticated;

-- Permanent monthly history. One row per snapshot day; numbers only.
create table if not exists public.growth_snapshots (
  snapshot_date date primary key,
  taken_at timestamptz not null default now(),
  metrics jsonb not null
);

alter table public.growth_snapshots enable row level security;

drop policy if exists "Admins can read growth snapshots" on public.growth_snapshots;
create policy "Admins can read growth snapshots"
  on public.growth_snapshots for select
  to authenticated
  using (public.is_current_user_admin());

grant select on table public.growth_snapshots to authenticated;

comment on table public.growth_snapshots is
  'Aggregate growth numbers saved monthly. Counts and rates only; kept after events are deleted.';

-- Saves today's numbers. Never overwrites a day that already has a snapshot.
create or replace function public.take_growth_snapshot()
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
begin
  insert into public.growth_snapshots (snapshot_date, metrics)
  values (v_day, public.compute_growth_metrics(12))
  on conflict (snapshot_date) do nothing;
  return v_day;
end;
$$;

revoke all on function public.take_growth_snapshot() from public, anon, authenticated;
grant execute on function public.take_growth_snapshot() to service_role;

-- Same thing for the admin button, so the history can start today.
create or replace function public.save_growth_snapshot()
returns date
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  return public.take_growth_snapshot();
end;
$$;

revoke all on function public.save_growth_snapshot() from public, anon;
grant execute on function public.save_growth_snapshot() to authenticated;

-- 04:15 UTC on the 1st of every month. Scheduling by name again replaces the earlier schedule.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'resuming-growth-snapshot',
      '15 4 1 * *',
      'select public.take_growth_snapshot()'
    );
  end if;
end;
$$;
