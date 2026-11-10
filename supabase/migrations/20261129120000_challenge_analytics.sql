-- Challenge counts for the admin analytics page.
-- Counts only: no titles, no account ids, no step totals, no minutes.

create or replace function public.challenge_analytics_summary(p_days integer)
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

  with created as (
    select id, kind, shape, status, ends_on, ended_on, created_at
    from public.challenges
    where created_at >= v_since
      and status <> 'deleted'
  ),
  joins as (
    select m.challenge_id, m.user_id, m.created_at
    from public.challenge_members m
    join public.challenges c on c.id = m.challenge_id
    where m.created_at >= v_since
      and c.status <> 'deleted'
  ),
  days as (
    select
      g.day::date as day,
      (select count(*) from created c where (c.created_at at time zone 'utc')::date = g.day::date) as started,
      (select count(*) from joins j where (j.created_at at time zone 'utc')::date = g.day::date) as joined
    from generate_series(v_first::timestamp, v_today::timestamp, interval '1 day') as g(day)
  )
  select jsonb_build_object(
    'started', (select count(*) from created),
    'walking', (select count(*) from created where kind = 'walk'),
    'meditation', (select count(*) from created where kind = 'meditate'),
    'race', (select count(*) from created where shape = 'race'),
    'together', (select count(*) from created where shape = 'together'),
    'joined', (select count(*) from joins),
    'people', (select count(distinct user_id) from joins),
    'withMember', (select count(*) from created c where exists (
      select 1 from public.challenge_members m where m.challenge_id = c.id
    )),
    'reached3', (select count(*) from created c where (
      select count(*) from public.challenge_members m
      where m.challenge_id = c.id and m.left_on is null
    ) >= 3),
    'stillGoing', (select count(*) from created where status = 'active'),
    'ended', (select count(*) from created where status = 'ended'),
    'endedEarly', (select count(*) from created where status = 'ended' and ended_on is not null and ended_on < ends_on),
    'perDay', coalesce((
      select jsonb_agg(
        jsonb_build_object('day', d.day, 'started', d.started, 'joined', d.joined)
        order by d.day
      )
      from days d
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.challenge_analytics_summary(integer) from public, anon;
grant execute on function public.challenge_analytics_summary(integer) to authenticated;
