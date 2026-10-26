-- The result columns share names with the query columns, so Postgres refused the call
-- with "column reference active_users is ambiguous" and the API returned 400.

create or replace function public.product_analytics_summary(p_days integer)
returns table (
  signups bigint,
  d1_retention numeric,
  d7_retention numeric,
  logs_per_active_user numeric,
  comeback_count bigint,
  active_users bigint,
  log_events bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_days integer := greatest(1, least(coalesce(p_days, 7), 90));
  v_since timestamptz := date_trunc('day', now() at time zone 'utc')
    - make_interval(days => v_days - 1);
begin
  if not public.is_current_user_admin() then
    raise exception 'not authorized';
  end if;

  return query
  with signup_users as (
    select e.user_id, min(e.created_at) as signed_up_at
    from public.events e
    where e.name = 'signup_completed'
      and e.user_id is not null
      and e.created_at >= v_since
    group by e.user_id
  ),
  eligible_d1 as (
    select user_id, signed_up_at
    from signup_users
    where signed_up_at < now() - interval '1 day'
  ),
  returned_d1 as (
    select distinct s.user_id
    from eligible_d1 s
    join public.events e
      on e.user_id = s.user_id
     and e.created_at >= s.signed_up_at + interval '1 day'
     and e.created_at < s.signed_up_at + interval '2 days'
  ),
  eligible_d7 as (
    select user_id, signed_up_at
    from signup_users
    where signed_up_at < now() - interval '7 days'
  ),
  returned_d7 as (
    select distinct s.user_id
    from eligible_d7 s
    join public.events e
      on e.user_id = s.user_id
     and e.created_at >= s.signed_up_at + interval '7 days'
     and e.created_at < s.signed_up_at + interval '8 days'
  ),
  log_stats as (
    select
      count(*)::bigint as log_events,
      count(distinct user_id)::bigint as active_users
    from public.events
    where name = 'log_created'
      and created_at >= v_since
      and user_id is not null
  ),
  comebacks as (
    select count(*)::bigint as comeback_count
    from public.events
    where name = 'comeback'
      and created_at >= v_since
  )
  select
    (select count(*)::bigint from signup_users),
    case
      when (select count(*) from eligible_d1) = 0 then null
      else round(
        (select count(*)::numeric from returned_d1)
        / (select count(*)::numeric from eligible_d1),
        4
      )
    end,
    case
      when (select count(*) from eligible_d7) = 0 then null
      else round(
        (select count(*)::numeric from returned_d7)
        / (select count(*)::numeric from eligible_d7),
        4
      )
    end,
    case
      when (select log_stats.active_users from log_stats) = 0 then null
      else round(
        (select log_stats.log_events::numeric from log_stats)
        / (select log_stats.active_users::numeric from log_stats),
        2
      )
    end,
    (select comebacks.comeback_count from comebacks),
    (select log_stats.active_users from log_stats),
    (select log_stats.log_events from log_stats);
end;
$$;

revoke all on function public.product_analytics_summary(integer) from public;
grant execute on function public.product_analytics_summary(integer) to authenticated;
