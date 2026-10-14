-- Checks to run before paying a referral group (P15-15, "Close the fake-install hole").
--
-- marketing_record_open is open to anyone, so install counts can be faked. Until installs are
-- verified with Play Integrity, pay only after these three checks:
--   1. The admin types in the installs Google Play Console shows for the group, and pay is based
--      on the lower of the two numbers.
--   2. Only installs whose 30-day window closed at least a week ago are payable ("settled").
--   3. Unusual patterns are flagged for a look: a sudden day of installs, or an unusually high
--      share of people who opened on five days.

alter table public.marketing_groups
  add column if not exists play_console_installs integer
    check (play_console_installs is null or play_console_installs >= 0),
  add column if not exists play_console_checked_on date;

-- Installs old enough to pay. The 30-day window (started_on + 29) closed p_hold_days ago or more.
create or replace function public.marketing_admin_settled(p_as_of date, p_hold_days integer default 7)
returns table (group_id uuid, installs integer, retained integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    return;
  end if;

  return query
  select
    i.group_id,
    count(*)::integer,
    count(*) filter (where cardinality(i.open_days) >= 5)::integer
  from public.marketing_installs i
  where p_as_of >= i.started_on + 29 + greatest(coalesce(p_hold_days, 0), 0)
  group by i.group_id;
end;
$$;

-- Patterns worth a look, per member link. A flag is a reason to check, not proof of anything.
--   spike:       at least 25 installs on one day, and at least 5 times the member's usual day
--   high_return: at least 20 installs with a closed window, and 70% or more opened on five days
create or replace function public.marketing_admin_flags(p_as_of date)
returns table (group_id uuid, member_id uuid, kind text, detail text, flagged_on date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    return;
  end if;

  return query
  with daily as (
    select i.group_id, i.member_id, i.started_on as day, count(*)::integer as n
    from public.marketing_installs i
    group by i.group_id, i.member_id, i.started_on
  ),
  totals as (
    select d.group_id, d.member_id, sum(d.n)::integer as total, min(d.day) as first_day
    from daily d
    group by d.group_id, d.member_id
  ),
  spikes as (
    select
      d.group_id,
      d.member_id,
      'spike'::text as kind,
      d.n::text || ' installs on one day, about '
        || round(d.n / greatest(1, (t.total - d.n)::numeric / greatest(1, (p_as_of - t.first_day + 1) - 1)))::text
        || ' times the usual day' as detail,
      d.day as flagged_on
    from daily d
    join totals t
      on t.group_id = d.group_id
     and t.member_id is not distinct from d.member_id
    where d.n >= 25
      and d.n >= 5 * greatest(1, (t.total - d.n)::numeric / greatest(1, (p_as_of - t.first_day + 1) - 1))
  ),
  closed as (
    select
      i.group_id,
      i.member_id,
      count(*)::integer as installs,
      count(*) filter (where cardinality(i.open_days) >= 5)::integer as retained
    from public.marketing_installs i
    where p_as_of > i.started_on + 29
    group by i.group_id, i.member_id
  ),
  high_return as (
    select
      c.group_id,
      c.member_id,
      'high_return'::text as kind,
      c.retained::text || ' of ' || c.installs::text || ' people ('
        || round(100.0 * c.retained / c.installs)::text
        || '%) opened on five days, which is unusually high' as detail,
      null::date as flagged_on
    from closed c
    where c.installs >= 20
      and c.retained::numeric / c.installs >= 0.7
  )
  select s.group_id, s.member_id, s.kind, s.detail, s.flagged_on from spikes s
  union all
  select h.group_id, h.member_id, h.kind, h.detail, h.flagged_on from high_return h;
end;
$$;

revoke all on function public.marketing_admin_settled(date, integer) from public, anon;
revoke all on function public.marketing_admin_flags(date) from public, anon;
grant execute on function public.marketing_admin_settled(date, integer) to authenticated;
grant execute on function public.marketing_admin_flags(date) to authenticated;
