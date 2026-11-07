-- challenge_teams.image is smallint. The picture function promised an integer,
-- so a real challenge made the query fail before it could return a row.

create or replace function public.challenge_team_pictures(p_code text)
returns table (team_id uuid, image int, photo_path text, card_path text)
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
  select t.id, t.image::int, t.photo_path, ev.photo_path
  from public.challenge_teams t
  where t.challenge_id = ev.id
  order by t.position;
end;
$$;
