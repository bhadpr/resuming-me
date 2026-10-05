-- Members can read their own group's install counts. They still cannot see payments or other people.
drop function if exists public.marketing_my_stats(date);

create function public.marketing_my_stats(p_as_of date)
returns table (
  group_id uuid,
  group_name text,
  group_code text,
  member_code text,
  install_goal integer,
  install_rate_rupees integer,
  retained_rate_rupees integer,
  cap_rupees integer,
  min_payout_installs integer,
  group_installs integer,
  group_in_progress integer,
  group_retained integer,
  group_ended_short integer,
  my_installs integer,
  my_in_progress integer,
  my_retained integer,
  my_ended_short integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    g.id,
    g.name,
    g.code,
    m.code,
    g.install_goal,
    g.install_rate_rupees,
    g.retained_rate_rupees,
    g.cap_rupees,
    g.min_payout_installs,
    c.installs,
    c.in_progress,
    c.retained,
    c.ended_short,
    mine.installs,
    mine.in_progress,
    mine.retained,
    mine.ended_short
  from public.marketing_members m
  join public.marketing_groups g on g.id = m.group_id
  cross join lateral public.marketing_counts(g.id, null, p_as_of) c
  cross join lateral public.marketing_counts(g.id, m.id, p_as_of) mine
  where m.user_id = auth.uid()
    and m.removed_at is null
  order by g.name;
end;
$$;

revoke all on function public.marketing_my_stats(date) from public;
grant execute on function public.marketing_my_stats(date) to authenticated;
