-- A picture for each team. The WhatsApp card uses the fixed walking image.

alter table public.challenge_teams
  add column image smallint not null default 1,
  add constraint challenge_teams_image check (image between 1 and 4);

update public.challenge_teams set image = (position % 4) + 1;

create or replace function public.challenge_team_assign_image()
returns trigger
language plpgsql
as $$
begin
  new.image := (new.position % 4) + 1;
  return new;
end;
$$;

create trigger challenge_teams_image
  before insert on public.challenge_teams
  for each row
  execute function public.challenge_team_assign_image();

create or replace function public.set_challenge_team_images(p_id uuid, p_images int[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
  i int;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenges c
    where c.id = p_id and c.owner_id = uid and c.kind = 'walk' and c.status <> 'deleted'
  ) then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  select count(*)::int into n from public.challenge_teams where challenge_id = p_id;
  if p_images is null or cardinality(p_images) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(p_images) v where v is null or v < 1 or v > 4) then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  for i in 1..n loop
    update public.challenge_teams
    set image = p_images[i]
    where challenge_id = p_id and position = i - 1;
  end loop;
end;
$$;

create or replace function public.challenge_team_pictures(p_code text)
returns table (team_id uuid, image int)
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
  select t.id, t.image
  from public.challenge_teams t
  where t.challenge_id = ev.id
  order by t.position;
end;
$$;

revoke all on function public.challenge_team_assign_image() from public;
revoke all on function public.set_challenge_team_images(uuid, int[]) from public;
revoke all on function public.challenge_team_pictures(text) from public;
grant execute on function public.set_challenge_team_images(uuid, int[]) to authenticated;
grant execute on function public.challenge_team_pictures(text) to anon, authenticated;
