-- Guests versus accounts: how many devices come back, with and without an account.
--
-- A "device" is an anonymous id: one Android install, or one browser. It is counted from the first
-- day it was active, in weekly cohorts.
--   active          opened the app or checked in that day (the same as the growth metrics)
--   guest           the device never sent an event while signed in
--   account         the device sent at least one event while signed in
--   back next day   active exactly 1 day after its first day (D1)
--   back in a week  active on any of the 7 days after its first day (W1). Measured on the same
--                   devices as D7, since a week has to be over before it can be judged.
--   D7 / D30        active exactly 7 / 30 days after its first day
-- All days are UTC days. A device counts toward D1, W1, D7 or D30 only once that day is over, so
-- every rate comes with the number of devices it was measured on.
--
-- Caveats the screen repeats: clearing the app's data or reinstalling makes a new device, and
-- someone who signs up later moves from guests to accounts, which lowers the guest rates a little.
-- Website visitors who only read the landing page count as web devices, so Android is the default.
--
-- Admin only. Reads the `events` table and writes nothing.

create or replace function public.guest_retention_summary(p_weeks integer default 12, p_platform text default 'android')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_weeks integer := greatest(1, least(coalesce(p_weeks, 12), 26));
  v_platform text := case when p_platform in ('android', 'web') then p_platform else 'all' end;
  v_today date := (now() at time zone 'utc')::date;
  v_first_week date;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  v_first_week := date_trunc('week', v_today::timestamp)::date - (v_weeks - 1) * 7;

  with ev as (
    select anon_id, (created_at at time zone 'utc')::date as day
    from public.events
    where name in ('app_opened', 'log_created')
      and (v_platform = 'all' or platform = v_platform)
  ),
  days as (
    select distinct anon_id, day from ev
  ),
  device as (
    select anon_id, min(day) as first_day from ev group by anon_id
  ),
  signed_in as (
    select distinct anon_id from public.events where user_id is not null
  ),
  flags as (
    select
      d.anon_id,
      date_trunc('week', d.first_day::timestamp)::date as week_start,
      (s.anon_id is not null) as has_account,
      d.first_day + 1 < v_today as el1,
      d.first_day + 7 < v_today as el7,
      d.first_day + 30 < v_today as el30,
      exists (select 1 from days x where x.anon_id = d.anon_id and x.day = d.first_day + 1) as r1,
      exists (select 1 from days x where x.anon_id = d.anon_id and x.day between d.first_day + 1 and d.first_day + 7) as rw1,
      exists (select 1 from days x where x.anon_id = d.anon_id and x.day = d.first_day + 7) as r7,
      exists (select 1 from days x where x.anon_id = d.anon_id and x.day = d.first_day + 30) as r30
    from device d
    left join signed_in s on s.anon_id = d.anon_id
    where d.first_day >= v_first_week
  ),
  stats as (
    select
      week_start,
      has_account,
      count(*) as size,
      count(*) filter (where el1) as e1,
      count(*) filter (where el1 and r1) as r1,
      count(*) filter (where el7 and rw1) as rw1,
      count(*) filter (where el7) as e7,
      count(*) filter (where el7 and r7) as r7,
      count(*) filter (where el30) as e30,
      count(*) filter (where el30 and r30) as r30
    from flags
    group by grouping sets ((week_start, has_account), (has_account))
  ),
  weeks as (
    select g::date as week_start
    from generate_series(v_first_week::timestamp, date_trunc('week', v_today::timestamp), interval '7 days') g
  )
  select jsonb_build_object(
    'platform', v_platform,
    'generatedAt', now(),
    'weeks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekStart', w.week_start,
          'guest', coalesce((select to_jsonb(s) - 'week_start' - 'has_account' from stats s where s.week_start = w.week_start and not s.has_account), '{}'::jsonb),
          'account', coalesce((select to_jsonb(s) - 'week_start' - 'has_account' from stats s where s.week_start = w.week_start and s.has_account), '{}'::jsonb)
        )
        order by w.week_start
      )
      from weeks w
    ), '[]'::jsonb),
    'headline', jsonb_build_object(
      'guest', coalesce((select to_jsonb(s) - 'week_start' - 'has_account' from stats s where s.week_start is null and not s.has_account), '{}'::jsonb),
      'account', coalesce((select to_jsonb(s) - 'week_start' - 'has_account' from stats s where s.week_start is null and s.has_account), '{}'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.guest_retention_summary(integer, text) from public, anon;
grant execute on function public.guest_retention_summary(integer, text) to authenticated;
