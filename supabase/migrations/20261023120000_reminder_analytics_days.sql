-- Reminder analytics: reminders added and done for each of the last 14 days (UTC days, zero days
-- included, inside the chosen window), and how many reminders were added as a repeat and how
-- many repeat reminders were marked done. Counts only; reminder text is never sent with events.
-- Events from before repeats existed carry no `repeat` property and count as one-time.

create or replace function public.reminder_analytics_summary(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_today date := (now() at time zone 'utc')::date;
  v_first date;
  v_result jsonb;
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;
  v_since := public.analytics_window_start(p_days);
  v_first := greatest((v_since at time zone 'utc')::date, v_today - 13);

  with ev as (
    select name, props, user_id, anon_id, created_at
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
  ),
  days as (
    select
      g.day::date as day,
      count(e.name) filter (where e.name = 'reminder_added') as added,
      count(e.name) filter (where e.name = 'reminder_done') as done
    from generate_series(v_first::timestamp, v_today::timestamp, interval '1 day') as g(day)
    left join ev e
      on e.name in ('reminder_added', 'reminder_done')
     and (e.created_at at time zone 'utc')::date = g.day::date
    group by g.day
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
    'repeatAdded', jsonb_build_object(
      'day', count(*) filter (where name = 'reminder_added' and props ->> 'repeat' = 'day'),
      'week', count(*) filter (where name = 'reminder_added' and props ->> 'repeat' = 'week')
    ),
    'repeatDone', count(*) filter (where name = 'reminder_done' and props ->> 'repeat' in ('day', 'week')),
    'perDay', coalesce((
      select jsonb_agg(
        jsonb_build_object('day', d.day, 'added', d.added, 'done', d.done)
        order by d.day
      )
      from days d
    ), '[]'::jsonb),
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
