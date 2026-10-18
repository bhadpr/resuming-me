-- Admin analytics, page 2: every event per week or month, first opens of the Android app by
-- version and language, and the errors the app reports (the `app_error` event).
--
-- All counted in SQL from the first-party `events` table, so no rows are downloaded and the
-- 1,000-row API limit never cuts anything off. Admin only. Days and weeks are UTC. A week starts on
-- Monday, a month on the 1st.
--
-- Language: the app now sends `locale` with `app_opened`. Events from before that carry none, so
-- a device counts as "unknown" until it opens the new version.
--
-- A "device" is an anonymous id kept on the phone (or in the browser). Clearing the app's data or
-- reinstalling makes a new one, so first opens can be a little higher than real new people.

-- Events per week or month. p_period is 'week' or 'month'. Oldest period first. The last period is
-- the one still running.
create or replace function public.event_counts_by_period(p_period text, p_periods integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month boolean := coalesce(p_period, 'week') = 'month';
  v_n integer := greatest(1, least(coalesce(p_periods, 12), case when v_month then 13 else 26 end));
  v_step interval := case when v_month then interval '1 month' else interval '7 days' end;
  v_current date := date_trunc(case when v_month then 'month' else 'week' end, now() at time zone 'utc')::date;
  v_first date;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  v_first := (v_current::timestamp - v_step * (v_n - 1))::date;

  with starts as (
    select g::date as start
    from generate_series(v_first::timestamp, v_current::timestamp, v_step) as g
  ),
  ev as (
    select
      name,
      date_trunc(case when v_month then 'month' else 'week' end, created_at at time zone 'utc')::date as start,
      anon_id
    from public.events
    where created_at >= (v_first::timestamp at time zone 'utc')
  ),
  counts as (
    select name, start, count(*) as n, count(distinct anon_id) as devices
    from ev
    group by name, start
  ),
  names as (
    select name, sum(n) as total
    from counts
    group by name
    order by total desc, name
    limit 150
  )
  select jsonb_build_object(
    'period', case when v_month then 'month' else 'week' end,
    'currentStart', v_current,
    'starts', (select jsonb_agg(s.start order by s.start) from starts s),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', nm.name,
          'total', nm.total,
          'counts', (
            select jsonb_agg(coalesce(c.n, 0) order by s.start)
            from starts s
            left join counts c on c.name = nm.name and c.start = s.start
          ),
          'devices', (
            select jsonb_agg(coalesce(c.devices, 0) order by s.start)
            from starts s
            left join counts c on c.name = nm.name and c.start = s.start
          )
        )
        order by nm.total desc, nm.name
      )
      from names nm
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.event_counts_by_period(text, integer) from public, anon;
grant execute on function public.event_counts_by_period(text, integer) to authenticated;

-- First opens of the Android app, and the devices that opened it in the window.
create or replace function public.app_installs_summary(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_first_day date;
  v_today date := (now() at time zone 'utc')::date;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  v_since := public.analytics_window_start(p_days);
  v_first_day := (v_since at time zone 'utc')::date;

  with opens as (
    select
      anon_id,
      platform,
      created_at,
      coalesce(nullif(app_version, ''), 'unknown') as version,
      case when props ->> 'locale' in ('en', 'hi', 'gu', 'mr', 'te', 'ta', 'bn') then props ->> 'locale' end as locale
    from public.events
    where name = 'app_opened'
  ),
  android as (
    select * from opens where platform = 'android'
  ),
  first_open as (
    select distinct on (anon_id) anon_id, version, created_at
    from android
    order by anon_id, created_at
  ),
  new_devices as (
    select * from first_open where created_at >= v_since
  ),
  latest_language as (
    select distinct on (anon_id) anon_id, locale
    from opens
    where locale is not null
    order by anon_id, created_at desc
  ),
  active_android as (
    select distinct on (anon_id) anon_id, version
    from android
    where created_at >= v_since
    order by anon_id, created_at desc
  ),
  active_web as (
    select distinct on (anon_id) anon_id
    from opens
    where platform = 'web' and created_at >= v_since
    order by anon_id, created_at desc
  ),
  new_by_version as (
    select version as key, count(*) as n from new_devices group by 1
  ),
  new_by_language as (
    select coalesce(l.locale, 'unknown') as key, count(*) as n
    from new_devices d
    left join latest_language l on l.anon_id = d.anon_id
    group by 1
  ),
  active_by_version as (
    select version as key, count(*) as n from active_android group by 1
  ),
  active_by_language as (
    select coalesce(l.locale, 'unknown') as key, count(*) as n
    from active_android d
    left join latest_language l on l.anon_id = d.anon_id
    group by 1
  ),
  web_by_language as (
    select coalesce(l.locale, 'unknown') as key, count(*) as n
    from active_web d
    left join latest_language l on l.anon_id = d.anon_id
    group by 1
  ),
  per_day as (
    select g::date as day, count(d.anon_id) as n
    from generate_series(v_first_day::timestamp, v_today::timestamp, interval '1 day') as g
    left join new_devices d on (d.created_at at time zone 'utc')::date = g::date
    group by g
  )
  select jsonb_build_object(
    'since', v_first_day,
    'firstOpens', (select count(*) from new_devices),
    'firstOpensByVersion', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from new_by_version), '[]'::jsonb),
    'firstOpensByLanguage', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from new_by_language), '[]'::jsonb),
    'firstOpensPerDay', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', n) order by day) from per_day), '[]'::jsonb),
    'activeDevices', (select count(*) from active_android),
    'activeByVersion', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from active_by_version), '[]'::jsonb),
    'activeByLanguage', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from active_by_language), '[]'::jsonb),
    'webDevices', (select count(*) from active_web),
    'webByLanguage', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from web_by_language), '[]'::jsonb),
    'languageKnownSince', (
      select min(created_at)::date from public.events where name = 'app_opened' and props ? 'locale'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.app_installs_summary(integer) from public, anon;
grant execute on function public.app_installs_summary(integer) to authenticated;

-- Errors the app reported (`app_error`): totals, by version, and the most common messages.
create or replace function public.app_errors_summary(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_today date := (now() at time zone 'utc')::date;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  v_since := public.analytics_window_start(p_days);

  with err as (
    select
      anon_id,
      created_at,
      coalesce(nullif(app_version, ''), 'unknown') as version,
      coalesce(nullif(platform, ''), 'unknown') as platform,
      coalesce(props ->> 'kind', 'error') as kind,
      coalesce(nullif(props ->> 'message', ''), '(no message)') as message,
      props ->> 'file' as file,
      props ->> 'line' as line
    from public.events
    where name = 'app_error' and created_at >= v_since
  ),
  by_version as (
    select platform, version, count(*) as n, count(distinct anon_id) as devices
    from err
    group by platform, version
  ),
  top as (
    select
      message,
      kind,
      count(*) as n,
      count(distinct anon_id) as devices,
      max(created_at) as last_seen,
      (array_agg(version order by created_at desc))[1] as last_version,
      (array_agg(file order by created_at desc))[1] as file,
      (array_agg(line order by created_at desc))[1] as line
    from err
    group by message, kind
    order by n desc, last_seen desc
    limit 25
  ),
  per_day as (
    select g::date as day, count(e.anon_id) as n
    from generate_series(((v_since at time zone 'utc')::date)::timestamp, v_today::timestamp, interval '1 day') as g
    left join err e on (e.created_at at time zone 'utc')::date = g::date
    group by g
  )
  select jsonb_build_object(
    'total', (select count(*) from err),
    'devices', (select count(distinct anon_id) from err),
    'activeDevices', (
      select count(distinct anon_id)
      from public.events
      where name = 'app_opened' and created_at >= v_since
    ),
    'byVersion', coalesce((
      select jsonb_agg(jsonb_build_object('platform', platform, 'version', version, 'count', n, 'devices', devices) order by n desc, version)
      from by_version
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message', message, 'kind', kind, 'count', n, 'devices', devices,
        'lastSeen', last_seen, 'version', last_version, 'file', file, 'line', line
      ) order by n desc, last_seen desc)
      from top
    ), '[]'::jsonb),
    'perDay', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', n) order by day) from per_day), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.app_errors_summary(integer) from public, anon;
grant execute on function public.app_errors_summary(integer) to authenticated;
