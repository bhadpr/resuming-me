-- Admin analytics counted inside the database (P15-15, "Fix the analytics limit").
--
-- The Analytics screen used to download event rows and count them in the browser. The API returns
-- at most 1,000 rows per request, so with real traffic the oldest events were kept and the newest
-- were silently dropped. These functions count in SQL and send back only the totals.
-- Same rules as the old browser code, with one change: a person who signed up twice counts once
-- in the signup-week cohorts.

create or replace function public.analytics_window_start(p_days integer)
returns timestamptz
language sql
stable
as $$
  select (
    date_trunc('day', now() at time zone 'utc')
    - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)) - 1)
  ) at time zone 'utc';
$$;

revoke all on function public.analytics_window_start(integer) from public, anon, authenticated;

-- Onboarding funnel and first-week logging, per person (anonymous id, else user id).
create or replace function public.onboarding_funnel_summary(p_days integer)
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

  with ev as (
    select
      name,
      props,
      created_at,
      user_id,
      coalesce(nullif(anon_id, ''), user_id::text, created_at::text) as person
    from public.events
    where created_at >= v_since
      and name in (
        'onboarding_started', 'onboarding_step_completed', 'onboarding_timer_started',
        'onboarding_timer_completed', 'onboarding_timer_skipped', 'onboarding_reminder_set',
        'signin_shown', 'signup_completed', 'log_created'
      )
  ),
  steps as (
    select s.step, count(distinct e.person) as people
    from generate_series(1, 8) as s(step)
    left join ev e
      on e.name = 'onboarding_step_completed'
     and (case when e.props ->> 'step' ~ '^[0-9]+$' then (e.props ->> 'step')::integer end) = s.step
    group by s.step
  ),
  started as (
    select person, min(created_at) as at from ev where name = 'onboarding_started' group by person
  ),
  resumed as (
    select person, min(created_at) as at
    from ev
    where name in ('onboarding_timer_completed', 'log_created')
    group by person
  ),
  durations as (
    select round(extract(epoch from (r.at - s.at)))::float8 as secs
    from started s
    join resumed r using (person)
    where r.at >= s.at
  ),
  reminder as (
    select distinct on (person) person, props
    from ev
    where name = 'onboarding_reminder_set'
    order by person, created_at
  ),
  signup as (
    select user_id, min(created_at) as at
    from ev
    where name = 'signup_completed' and user_id is not null
    group by user_id
  ),
  logged as (
    select
      s.user_id,
      (e.created_at at time zone 'utc')::date - (s.at at time zone 'utc')::date as span
    from ev e
    join signup s on s.user_id = e.user_id
    where e.name = 'log_created'
  )
  select jsonb_build_object(
    'started', (select count(distinct person) from ev where name = 'onboarding_started'),
    'steps', (
      select jsonb_agg(jsonb_build_object('step', step, 'people', people) order by step) from steps
    ),
    'timerStarted', (select count(distinct person) from ev where name = 'onboarding_timer_started'),
    'timerCompleted', (select count(distinct person) from ev where name = 'onboarding_timer_completed'),
    'timerSkipped', (select count(distinct person) from ev where name = 'onboarding_timer_skipped'),
    'reminderSet', (
      select count(*) from reminder
      where props ->> 'time' is not null and props ->> 'time' <> 'none'
    ),
    'reminderNone', (
      select count(*) from reminder
      where props ->> 'time' is null or props ->> 'time' = 'none'
    ),
    'signinShown', (select count(distinct person) from ev where name = 'signin_shown'),
    'signups', (select count(*) from signup),
    'medianSecondsToFirstResume', (
      select round((percentile_cont(0.5) within group (order by secs))::numeric) from durations
    ),
    'loggedDay2', (select count(distinct user_id) from logged where span = 2),
    'loggedDay3', (select count(distinct user_id) from logged where span = 3),
    'loggedDay7', (select count(distinct user_id) from logged where span = 7),
    'signupCohort', (select count(*) from signup)
  )
  into v_result;

  return v_result;
end;
$$;

-- Guest journey (counted by anonymous id) and which habits and readings people create.
create or replace function public.guest_journey_summary(p_days integer)
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

  with ev as (
    select
      name,
      props,
      user_id,
      coalesce(nullif(anon_id, ''), user_id::text) as person
    from public.events
    where created_at >= v_since
      and name in (
        'landing_viewed', 'intent_journey_started', 'onboarding_started',
        'onboarding_step_completed', 'log_created', 'signin_shown', 'signup_completed',
        'activity_created', 'metric_created'
      )
  ),
  creates as (
    select
      props ->> 'template_id' as template_id,
      (props ->> 'template_id') = 'custom' as is_custom,
      (
        name = 'metric_created'
        or (props ->> 'template_id') in (
          'weight', 'steps', 'water', 'sleep_hours', 'fasting', 'protein', 'blood_pressure', 'heart_rate'
        )
      ) as is_vital
    from ev
    where name in ('activity_created', 'metric_created')
      and jsonb_typeof(props -> 'template_id') = 'string'
      and props ->> 'template_id' <> ''
  )
  select jsonb_build_object(
    'journey', jsonb_build_object(
      'landing', (select count(distinct person) from ev where name = 'landing_viewed'),
      'intentStarted', (select count(distinct person) from ev where name = 'intent_journey_started'),
      'setupStarted', (select count(distinct person) from ev where name = 'onboarding_started'),
      'habitsPicked', (
        select count(distinct person) from ev
        where name = 'onboarding_step_completed' and props ->> 'step' = '1'
      ),
      'firstLog', (
        select count(distinct person) from ev
        where name = 'log_created'
          and (
            props ->> 'signed_in' = 'false'
            or (props ->> 'signed_in' is null and user_id is null)
          )
      ),
      'signInShown', (select count(distinct person) from ev where name = 'signin_shown'),
      'signups', (select count(distinct person) from ev where name = 'signup_completed')
    ),
    'creates', jsonb_build_object(
      'habitsCatalog', (select count(*) from creates where not is_vital and not is_custom),
      'habitsCustom', (select count(*) from creates where not is_vital and is_custom),
      'vitalsCatalog', (select count(*) from creates where is_vital and not is_custom),
      'vitalsCustom', (select count(*) from creates where is_vital and is_custom),
      'topHabits', coalesce((
        select jsonb_agg(jsonb_build_object('id', template_id, 'count', n) order by n desc, template_id collate "C")
        from (
          select template_id, count(*) as n
          from creates
          where not is_vital and not is_custom
          group by template_id
          order by n desc, template_id collate "C"
          limit 8
        ) t
      ), '[]'::jsonb),
      'topVitals', coalesce((
        select jsonb_agg(jsonb_build_object('id', template_id, 'count', n) order by n desc, template_id collate "C")
        from (
          select template_id, count(*) as n
          from creates
          where is_vital and not is_custom
          group by template_id
          order by n desc, template_id collate "C"
          limit 8
        ) t
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- Reminder and shared-event counts. Counts only: reminder text is never sent with these events.
create or replace function public.reminder_analytics_summary(p_days integer)
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

  with ev as (
    select name, props, user_id, anon_id
    from public.events
    where created_at >= v_since
      and name in (
        'reminder_added', 'reminder_done', 'shared_event_created', 'shared_event_viewed',
        'shared_event_added', 'shared_event_installed', 'shared_event_cancelled',
        'shared_event_reported'
      )
  ),
  kinds as (
    select props ->> 'kind' as kind, count(*) as n
    from ev
    where name = 'reminder_added'
    group by 1
  )
  select jsonb_build_object(
    'added', count(*) filter (where name = 'reminder_added'),
    'done', count(*) filter (where name = 'reminder_done'),
    'people', count(distinct coalesce(user_id::text, anon_id))
      filter (where name in ('reminder_added', 'reminder_done')),
    'withTime', count(*) filter (where name = 'reminder_added' and props -> 'has_time' = 'true'::jsonb),
    'dayBefore', count(*) filter (where name = 'reminder_added' and props -> 'day_before' = 'true'::jsonb),
    'everyYear', count(*) filter (where name = 'reminder_added' and props -> 'every_year' = 'true'::jsonb),
    'signedIn', count(*) filter (where name = 'reminder_added' and props -> 'signed_in' = 'true'::jsonb),
    'doneFromNotification', count(*) filter (where name = 'reminder_done' and props ->> 'from' = 'notification'),
    'kinds', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'count', n)) from kinds), '[]'::jsonb),
    'shared', jsonb_build_object(
      'created', count(*) filter (where name = 'shared_event_created'),
      'opened', count(*) filter (where name = 'shared_event_viewed'),
      'added', count(*) filter (where name = 'shared_event_added'),
      'installs', count(*) filter (where name = 'shared_event_installed'),
      'cancelled', count(*) filter (where name = 'shared_event_cancelled'),
      'reported', count(*) filter (where name = 'shared_event_reported')
    )
  )
  into v_result
  from ev;

  return v_result;
end;
$$;

-- Comeback loop totals and signup-week cohorts.
create or replace function public.loop_analytics_summary(p_days integer default 90)
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

  with ev as (
    select name, user_id, created_at
    from public.events
    where created_at >= v_since
      and name in (
        'comeback', 'welcome_back_shown', 'review_generated', 'review_opened',
        'review_focus_set', 'review_shrink_used', 'signup_completed', 'log_created', 'app_opened'
      )
  ),
  comeback_users as (
    select distinct user_id from ev where name = 'comeback' and user_id is not null
  ),
  card_users as (
    select distinct user_id from ev where name = 'welcome_back_shown' and user_id is not null
  ),
  opened_users as (
    select distinct user_id from ev where name = 'review_opened' and user_id is not null
  ),
  acted_users as (
    select distinct user_id
    from ev
    where name in ('review_focus_set', 'review_shrink_used') and user_id is not null
  ),
  signups as (
    select user_id, min(created_at) as at
    from ev
    where name = 'signup_completed' and user_id is not null
    group by user_id
  ),
  showed as (
    select distinct user_id, (created_at at time zone 'utc')::date as day
    from ev
    where name in ('log_created', 'app_opened') and user_id is not null
  ),
  members as (
    select
      s.user_id,
      (s.at at time zone 'utc')::date as signup_day,
      date_trunc('week', s.at at time zone 'utc')::date as week_start
    from signups s
  ),
  flags as (
    select
      m.week_start,
      exists (
        select 1 from showed w
        where w.user_id = m.user_id and w.day >= m.signup_day + 7 and w.day < m.signup_day + 14
      ) as w2,
      exists (
        select 1 from showed w
        where w.user_id = m.user_id and w.day >= m.signup_day + 21 and w.day < m.signup_day + 28
      ) as w4,
      exists (
        select 1 from showed w
        where w.user_id = m.user_id and w.day >= m.signup_day + 49 and w.day < m.signup_day + 56
      ) as w8
    from members m
  ),
  cohorts as (
    select
      week_start,
      count(*) as size,
      case when v_today < week_start + 14 then null else (count(*) filter (where w2))::float8 / count(*) end as week2,
      case when v_today < week_start + 28 then null else (count(*) filter (where w4))::float8 / count(*) end as week4,
      case when v_today < week_start + 56 then null else (count(*) filter (where w8))::float8 / count(*) end as week8
    from flags
    group by week_start
  )
  select jsonb_build_object(
    'activeUsers', (select count(distinct user_id) from ev where user_id is not null),
    'comebacks', (select count(*) from ev where name = 'comeback'),
    'returnedWithCard', (select count(*) from card_users),
    'returnedWithoutCard', (
      select count(*) from comeback_users c where not exists (select 1 from card_users k where k.user_id = c.user_id)
    ),
    'reviewsGenerated', (select count(*) from ev where name = 'review_generated'),
    'reviewsOpened', (select count(*) from ev where name = 'review_opened'),
    'openedUsers', (select count(*) from opened_users),
    'actedUsers', (
      select count(*) from opened_users o where exists (select 1 from acted_users a where a.user_id = o.user_id)
    ),
    'cohorts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'weekStart', week_start,
          'size', size,
          'week2', week2,
          'week4', week4,
          'week8', week8
        )
        order by week_start desc
      )
      from cohorts
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.onboarding_funnel_summary(integer) from public, anon;
revoke all on function public.guest_journey_summary(integer) from public, anon;
revoke all on function public.reminder_analytics_summary(integer) from public, anon;
revoke all on function public.loop_analytics_summary(integer) from public, anon;
grant execute on function public.onboarding_funnel_summary(integer) to authenticated;
grant execute on function public.guest_journey_summary(integer) to authenticated;
grant execute on function public.reminder_analytics_summary(integer) to authenticated;
grant execute on function public.loop_analytics_summary(integer) to authenticated;
