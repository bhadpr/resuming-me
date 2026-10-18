-- Admin analytics, round two:
--   * app_installs_summary also says where new installs came from (`install_attributed`)
--   * alert_status_summary: can the alerts on each phone actually ring (`alerts_status`)
--   * event_prop_breakdown: one event's count split by one of its properties
-- All of them are admin only and read the `events` table. Nothing is written.

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
  source_of as (
    select distinct on (anon_id)
      anon_id,
      nullif(props ->> 'source', '') as source,
      nullif(props ->> 'content', '') as content
    from public.events
    where name = 'install_attributed'
    order by anon_id, created_at
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
  new_by_source as (
    select
      case
        when s.source is null then 'unknown'
        when s.content is null then s.source
        else s.source || ' · ' || s.content
      end as key,
      count(*) as n
    from new_devices d
    left join source_of s on s.anon_id = d.anon_id
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
    'firstOpensBySource', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from new_by_source), '[]'::jsonb),
    'firstOpensPerDay', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', n) order by day) from per_day), '[]'::jsonb),
    'activeDevices', (select count(*) from active_android),
    'activeByVersion', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from active_by_version), '[]'::jsonb),
    'activeByLanguage', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from active_by_language), '[]'::jsonb),
    'webDevices', (select count(*) from active_web),
    'webByLanguage', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key) from web_by_language), '[]'::jsonb),
    'languageKnownSince', (
      select min(created_at)::date from public.events where name = 'app_opened' and props ? 'locale'
    ),
    'sourceKnownSince', (
      select min(created_at)::date from public.events where name = 'install_attributed'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.app_installs_summary(integer) from public, anon;
grant execute on function public.app_installs_summary(integer) to authenticated;

-- Can the alerts this phone planned actually ring? The latest `alerts_status` from each Android device.
create or replace function public.alert_status_summary(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  v_since := public.analytics_window_start(p_days);

  with latest as (
    select distinct on (anon_id)
      anon_id,
      coalesce(props ->> 'notifications', 'unknown') as notifications,
      coalesce(props ->> 'exact_alarms', 'unknown') as exact_alarms,
      coalesce(nullif(app_version, ''), 'unknown') as version
    from public.events
    where name = 'alerts_status'
      and platform = 'android'
      and created_at >= v_since
    order by anon_id, created_at desc
  ),
  states as (
    select notifications, exact_alarms, count(*) as n
    from latest
    group by 1, 2
  )
  select jsonb_build_object(
    'devices', (select count(*) from latest),
    'ready', (select count(*) from latest where notifications = 'granted' and exact_alarms <> 'denied'),
    'notificationsOff', (select count(*) from latest where notifications <> 'granted'),
    'exactAlarmsOff', (select count(*) from latest where notifications = 'granted' and exact_alarms = 'denied'),
    'states', coalesce((
      select jsonb_agg(
        jsonb_build_object('notifications', notifications, 'exactAlarms', exact_alarms, 'count', n)
        order by n desc, notifications, exact_alarms
      )
      from states
    ), '[]'::jsonb),
    'knownSince', (select min(created_at)::date from public.events where name = 'alerts_status')
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.alert_status_summary(integer) from public, anon;
grant execute on function public.alert_status_summary(integer) to authenticated;

-- One event's count split by one of its properties, such as reminder_added by kind.
-- Returns the 30 biggest values; a missing property counts as "(not set)".
create or replace function public.event_prop_breakdown(p_name text, p_prop text, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  if p_prop is null or p_prop !~ '^[a-z][a-z0-9_]{0,39}$' then
    raise exception 'invalid property';
  end if;
  v_since := public.analytics_window_start(p_days);

  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n, 'devices', devices) order by n desc, key), '[]'::jsonb)
  into v_result
  from (
    select
      coalesce(nullif(props ->> p_prop, ''), '(not set)') as key,
      count(*) as n,
      count(distinct anon_id) as devices
    from public.events
    where name = p_name
      and created_at >= v_since
    group by 1
    order by n desc, key
    limit 30
  ) rows;

  return jsonb_build_object('name', p_name, 'prop', p_prop, 'rows', v_result);
end;
$$;

revoke all on function public.event_prop_breakdown(text, text, integer) from public, anon;
grant execute on function public.event_prop_breakdown(text, text, integer) to authenticated;
