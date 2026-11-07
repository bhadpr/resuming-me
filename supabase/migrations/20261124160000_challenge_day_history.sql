-- Day by day team averages for the challenge graph. A person's own steps come back only to them.

create function public.challenge_day_history(p_code text)
returns table (kind text, team_id uuid, day date, steps int)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
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

  return query
  select 'mine'::text, null::uuid, md.day, md.raw_steps
  from public.challenge_member_days md
  where md.challenge_id = ev.id
    and md.user_id = auth.uid()
  order by md.day;
end;
$$;

revoke all on function public.challenge_day_history(text) from public;
grant execute on function public.challenge_day_history(text) to anon, authenticated;
