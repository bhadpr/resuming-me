-- The organizer can rename the challenge, move the last day, and rewrite each team's name and WhatsApp group.
-- A new picture is optional. An empty path keeps the picture already on that team or on the card.

create or replace function public.update_challenge_details(
  p_id uuid,
  p_title text,
  p_ends_on date,
  p_team_ids uuid[],
  p_team_names text[],
  p_links text[],
  p_card text default null,
  p_photo_paths text[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $edit$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
  n int;
  i int;
  v_title text;
  v_today date;
  v_status text;
  v_ended date;
  v_name text;
  v_link text;
  v_photo text;
  names text[];
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  select * into ev from public.challenges c where c.id = p_id;
  if not found or ev.owner_id is distinct from uid or ev.status = 'deleted' then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  if ev.kind not in ('walk', 'meditate') then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;

  v_title := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  if char_length(v_title) not between 1 and 60 or public.has_web_link(v_title) then
    raise exception 'challenge_bad_title' using errcode = 'P0001';
  end if;
  if p_ends_on is null or (p_ends_on - ev.starts_on) not between 0 and 29 then
    raise exception 'challenge_bad_dates' using errcode = 'P0001';
  end if;

  select count(*)::int into n from public.challenge_teams where challenge_id = p_id;
  if p_team_ids is null
     or p_team_names is null
     or p_links is null
     or cardinality(p_team_ids) <> n
     or cardinality(p_team_names) <> n
     or cardinality(p_links) <> n
     or (select count(distinct id) from unnest(p_team_ids) id) <> n
     or exists (
       select 1
       from unnest(p_team_ids) id
       where not exists (
         select 1 from public.challenge_teams t
         where t.id = id and t.challenge_id = p_id
       )
     )
  then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  if p_photo_paths is not null and cardinality(p_photo_paths) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;

  names := array[]::text[];
  for i in 1..n loop
    v_name := regexp_replace(btrim(coalesce(p_team_names[i], '')), '\s+', ' ', 'g');
    if v_name = '' or char_length(v_name) > 40 or public.has_web_link(v_name) then
      raise exception 'challenge_bad_teams' using errcode = 'P0001';
    end if;
    names := names || v_name;
    v_link := nullif(btrim(coalesce(p_links[i], '')), '');
    if v_link is not null
       and v_link !~ '^https://chat\.whatsapp\.com/(invite/)?[A-Za-z0-9]{10,64}$' then
      raise exception 'challenge_whatsapp' using errcode = 'P0001';
    end if;
    if p_photo_paths is not null then
      v_photo := nullif(btrim(coalesce(p_photo_paths[i], '')), '');
      if v_photo is not null and v_photo !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
        raise exception 'challenge_bad_teams' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  if (select count(distinct lower(item)) from unnest(names) item) <> n then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;
  if p_card is not null and btrim(p_card) <> '' and p_card !~ ('^' || p_id::text || '/[a-z0-9-]{8,64}\.jpg$') then
    raise exception 'challenge_bad_teams' using errcode = 'P0001';
  end if;

  begin
    v_today := (now() at time zone ev.time_zone)::date;
  exception when invalid_parameter_value then
    v_today := (now() at time zone 'UTC')::date;
  end;

  v_status := ev.status;
  v_ended := ev.ended_on;
  if p_ends_on is distinct from ev.ends_on then
    if p_ends_on >= v_today and ev.status = 'ended' then
      v_status := 'active';
      v_ended := null;
    elsif p_ends_on < v_today and ev.status = 'active' then
      v_status := 'ended';
      v_ended := p_ends_on;
    end if;
  end if;

  update public.challenges
  set title = v_title,
      ends_on = p_ends_on,
      status = v_status,
      ended_on = v_ended,
      photo_path = case
        when p_card is not null and btrim(p_card) <> '' then btrim(p_card)
        else photo_path
      end
  where id = p_id;

  -- Free the names first so two teams can trade names in one save.
  update public.challenge_teams
  set name = left('·' || id::text, 40)
  where challenge_id = p_id;

  for i in 1..n loop
    v_link := nullif(btrim(coalesce(p_links[i], '')), '');
    v_photo := case
      when p_photo_paths is null then null
      else nullif(btrim(coalesce(p_photo_paths[i], '')), '')
    end;
    update public.challenge_teams
    set name = names[i],
        whatsapp_url = v_link,
        photo_path = coalesce(v_photo, photo_path)
    where id = p_team_ids[i]
      and challenge_id = p_id;
  end loop;
end;
$edit$;

revoke all on function public.update_challenge_details(uuid, text, date, uuid[], text[], text[], text, text[]) from public;
grant execute on function public.update_challenge_details(uuid, text, date, uuid[], text[], text[], text, text[]) to authenticated;
