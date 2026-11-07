-- A person can be in 5 open challenges. Today lists all five.
-- A saved meditation team day is the public chart point once that day had 3 members.

begin;

do $$
declare
  src text;
begin
  src := pg_get_functiondef('public.create_walking_challenge(text,text,date,date,bigint,text[],text,boolean,int,text,text)'::regprocedure);
  src := replace(src, 'if open_joined >= 3 then', 'if open_joined >= 5 then');
  execute src;

  src := pg_get_functiondef('public.join_walking_challenge(text,uuid,text)'::regprocedure);
  src := replace(src, 'if open_joined >= 3 then', 'if open_joined >= 5 then');
  execute src;

  src := pg_get_functiondef('public.my_challenge_index()'::regprocedure);
  src := replace(src, 'limit 3', 'limit 5');
  execute src;
end $$;

create or replace function public.challenge_day_history(p_code text)
returns table (kind text, team_id uuid, day date, steps int)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  today date;
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

  if ev.kind = 'meditate' then
    today := (now() at time zone ev.time_zone)::date;
    return query
    select
      'team'::text,
      td.team_id,
      td.day,
      case
        when ev.shape = 'together' then td.capped_sum::int
        else round(td.capped_sum::numeric / td.member_count)::int
      end
    from public.challenge_team_days td
    where td.challenge_id = ev.id
      and td.member_count >= 3
    order by td.day, td.team_id;

    return query
    select
      'team'::text,
      m.team_id,
      d.day,
      case
        when ev.shape = 'together' then sum(coalesce(md.capped_steps, 0))::int
        else (sum(coalesce(md.capped_steps, 0)) / count(*))::int
      end
    from (
      select generate_series(
        ev.starts_on,
        least(ev.ends_on, today),
        interval '1 day'
      )::date as day
    ) d
    join public.challenge_members m
      on m.challenge_id = ev.id
     and m.joined_on <= d.day
     and (m.left_on is null or d.day < m.left_on)
    left join public.challenge_member_days md
      on md.challenge_id = ev.id
     and md.user_id = m.user_id
     and md.day = d.day
    where today >= ev.starts_on
      and not exists (
        select 1 from public.challenge_team_days td
        where td.challenge_id = ev.id
          and td.team_id = m.team_id
          and td.day = d.day
      )
    group by m.team_id, d.day
    having count(*) >= 3
    order by d.day, m.team_id;
  else
    return query
    select
      'team'::text,
      td.team_id,
      td.day,
      (round(td.capped_sum::numeric / td.member_count / 100) * 100)::int
    from public.challenge_team_days td
    where td.challenge_id = ev.id
      and td.member_count > 0
    order by td.day, td.team_id;
  end if;

  return query
  select 'mine'::text, null::uuid, md.day, md.raw_steps
  from public.challenge_member_days md
  where md.challenge_id = ev.id
    and md.user_id = auth.uid()
  order by md.day;
end;
$$;

commit;
