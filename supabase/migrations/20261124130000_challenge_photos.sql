-- The organizer's own picture for the WhatsApp card, and one for each team.

alter table public.challenges
  add column photo_path text,
  add constraint challenges_photo_path check (
    photo_path is null or photo_path ~ ('^' || id::text || '/[a-z0-9-]{8,64}\.jpg$')
  );

alter table public.challenge_teams
  add column photo_path text,
  add constraint challenge_teams_photo_path check (
    photo_path is null or photo_path ~ ('^' || challenge_id::text || '/[a-z0-9-]{8,64}\.jpg$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-photos', 'challenge-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload challenge photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'challenge-photos'
    and exists (
      select 1 from public.challenges c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_id = auth.uid()
        and c.status <> 'deleted'
    )
  );

create policy "Owners delete challenge photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'challenge-photos'
    and exists (
      select 1 from public.challenges c
      where c.id::text = (storage.foldername(name))[1]
        and c.owner_id = auth.uid()
    )
  );

create or replace function public.set_challenge_photos(
  p_id uuid,
  p_card text default null,
  p_team_paths text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
  i int;
  path text;
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

  if p_card is not null and p_card <> '' then
    if p_card !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
    update public.challenges set photo_path = p_card where id = p_id;
  end if;

  if p_team_paths is null then
    return;
  end if;
  select count(*)::int into n from public.challenge_teams where challenge_id = p_id;
  if cardinality(p_team_paths) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  for i in 1..n loop
    path := p_team_paths[i];
    if path is null or path = '' then
      continue;
    end if;
    if path !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
    update public.challenge_teams
    set photo_path = path
    where challenge_id = p_id and position = i - 1;
  end loop;
end;
$$;

drop function public.challenge_team_pictures(text);

create function public.challenge_team_pictures(p_code text)
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

create or replace function public.challenge_card_photo(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
begin
  if p_code is null or lower(btrim(p_code)) !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' then
    return null;
  end if;
  select * into ev from public.challenges c where c.code = lower(btrim(p_code));
  if not found or ev.status in ('deleted', 'switched_off') then
    return null;
  end if;
  return ev.photo_path;
end;
$$;

revoke all on function public.set_challenge_photos(uuid, text, text[]) from public;
revoke all on function public.challenge_team_pictures(text) from public;
revoke all on function public.challenge_card_photo(text) from public;
grant execute on function public.set_challenge_photos(uuid, text, text[]) to authenticated;
grant execute on function public.challenge_team_pictures(text) to anon, authenticated;
grant execute on function public.challenge_card_photo(text) to anon, authenticated;
