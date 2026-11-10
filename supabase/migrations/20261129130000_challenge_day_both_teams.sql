-- Day by day returns every team, including a day with nobody on it.
-- steps is that day's team total. average is the total divided by the people on the team that day.

drop function public.challenge_day_history(text);

create function public.challenge_day_history(p_code text)
returns table (kind text, team_id uuid, day date, steps int, average int)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  today date;
  open_day date;
begin
  if p_code is null or lower(btrim(p_code)) !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' then
    return;
  end if;
  select * into ev from public.challenges c where c.code = lower(btrim(p_code));
  if not found or ev.status = 'deleted' then
    return;
  end if;
  if ev.status = 'switched_off'
     and auth.uid() is distinct from ev.owner_id
     and not exists (
       select 1 from public.challenge_members m
       where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null
     ) then
    return;
  end if;

  today := (now() at time zone ev.time_zone)::date;
  if ev.status in ('active', 'switched_off')
     and today between ev.starts_on and ev.ends_on
     and not exists (
       select 1 from public.challenge_team_days td
       where td.challenge_id = ev.id and td.day = today
     ) then
    open_day := today;
  end if;

  return query
  with days as (
    select td.team_id, td.day, td.capped_sum::numeric as total, td.member_count as members
    from public.challenge_team_days td
    where td.challenge_id = ev.id
    union all
    select
      t.id,
      open_day,
      coalesce((
        select sum(md.capped_steps)::numeric
        from public.challenge_member_days md
        join public.challenge_members m
          on m.challenge_id = ev.id
         and m.user_id = md.user_id
         and m.team_id = t.id
         and m.joined_on <= open_day
         and (m.left_on is null or open_day < m.left_on)
        where md.challenge_id = ev.id
          and md.day = open_day
      ), 0),
      (
        select count(*)::int
        from public.challenge_members m
        where m.challenge_id = ev.id
          and m.team_id = t.id
          and m.joined_on <= open_day
          and (m.left_on is null or open_day < m.left_on)
      )
    from public.challenge_teams t
    where open_day is not null
      and t.challenge_id = ev.id
  )
  select
    'team'::text,
    d.team_id,
    d.day,
    case
      when ev.kind = 'meditate' then round(d.total)::int
      else (round(d.total / 100) * 100)::int
    end,
    case
      when d.members <= 0 then null
      when ev.kind = 'meditate' then round(d.total / d.members)::int
      else (round((d.total / d.members) / 100) * 100)::int
    end
  from days d
  order by d.day, d.team_id;

  return query
  select 'mine'::text, null::uuid, md.day, md.raw_steps, null::int
  from public.challenge_member_days md
  where md.challenge_id = ev.id
    and md.user_id = auth.uid()
  order by md.day;
end;
$$;

revoke all on function public.challenge_day_history(text) from public;
grant execute on function public.challenge_day_history(text) to anon, authenticated;
