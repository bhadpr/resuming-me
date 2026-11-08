-- The share line is the organizer's words. A team challenge and a group challenge
-- start from different sentences, and the organizer can rewrite either one.

alter table public.challenges
  add column if not exists share_message text;

alter table public.challenges
  drop constraint if exists challenges_share_message;

alter table public.challenges
  add constraint challenges_share_message check (
    share_message is null
    or (
      char_length(btrim(share_message)) between 1 and 280
      and not public.has_web_link(share_message)
    )
  );

create or replace function public.set_challenge_share_message(p_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  if auth.uid() is null then
    raise exception 'challenge_sign_in';
  end if;

  cleaned := nullif(btrim(coalesce(p_message, '')), '');
  if cleaned is not null and (
    char_length(cleaned) > 280 or public.has_web_link(cleaned)
  ) then
    raise exception 'challenge_message';
  end if;

  update public.challenges
  set share_message = cleaned
  where id = p_id and owner_id = auth.uid() and status <> 'deleted';

  if not found then
    raise exception 'challenge_unavailable';
  end if;
end;
$$;

revoke all on function public.set_challenge_share_message(uuid, text) from public;
grant execute on function public.set_challenge_share_message(uuid, text) to authenticated;

drop function public.get_challenge_board(text);

create function public.get_challenge_board(p_code text)
returns table (
  challenge_id uuid,
  board_code text,
  title text,
  shape text,
  kind text,
  status text,
  time_zone text,
  starts_on date,
  ends_on date,
  target bigint,
  is_owner boolean,
  my_team_id uuid,
  my_team_name text,
  team_id uuid,
  team_name text,
  member_count int,
  pace numeric,
  record_pace numeric,
  total_steps bigint,
  record_total bigint,
  day_number int,
  frozen_day_number int,
  days_left int,
  record_days_left int,
  score_phase text,
  joined_count int,
  card_ready boolean,
  my_raw int,
  my_capped int,
  my_day_closed boolean,
  my_leaving_on date,
  image int,
  photo_path text,
  card_path text,
  share_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.challenges%rowtype;
  mine uuid;
  shared date;
begin
  if p_code is null or lower(btrim(p_code)) !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' then
    perform public.challenge_note_miss();
    return;
  end if;

  select * into ev from public.challenges c where c.code = lower(btrim(p_code));
  if not found or ev.status = 'deleted' then
    perform public.challenge_note_miss();
    return;
  end if;

  perform public.challenge_apply_leaves(ev.id);

  select m.team_id into mine
  from public.challenge_members m
  where m.challenge_id = ev.id and m.user_id = auth.uid() and m.left_on is null;

  if ev.status = 'switched_off'
     and auth.uid() is distinct from ev.owner_id
     and mine is null then
    challenge_id := ev.id;
    board_code := ev.code;
    title := null;
    shape := ev.shape;
    kind := ev.kind;
    status := ev.status;
    time_zone := ev.time_zone;
    starts_on := ev.starts_on;
    ends_on := ev.ends_on;
    target := null;
    is_owner := false;
    my_team_id := null;
    my_team_name := null;
    team_id := null;
    team_name := null;
    member_count := 0;
    pace := null;
    record_pace := null;
    total_steps := null;
    record_total := null;
    day_number := null;
    frozen_day_number := null;
    days_left := null;
    record_days_left := null;
    score_phase := null;
    joined_count := 0;
    card_ready := false;
    my_raw := null;
    my_capped := null;
    my_day_closed := false;
    my_leaving_on := null;
    image := null;
    photo_path := null;
    card_path := null;
    share_message := null;
    return next;
    return;
  end if;

  select cs.shared_through into shared
  from public.challenge_card_shares cs
  where cs.challenge_id = ev.id and cs.user_id = auth.uid();

  return query
  with scores as materialized (
    select * from public.challenge_scores(ev.id)
  ),
  mark as (
    select max(scores.frozen_day) as latest from scores
  )
  select
    ev.id,
    ev.code,
    ev.title,
    ev.shape,
    ev.kind,
    ev.status,
    ev.time_zone,
    ev.starts_on,
    ev.ends_on,
    ev.target,
    auth.uid() = ev.owner_id,
    mine,
    (select tm.name from public.challenge_teams tm where tm.id = mine),
    s.team_id,
    s.team_name,
    s.member_count,
    s.pace,
    s.record_pace,
    s.total_steps,
    s.record_total,
    s.day_number,
    s.frozen_day_number,
    s.days_left,
    s.record_days_left,
    s.score_phase,
    s.joined_count,
    m.latest is not null and (shared is null or shared < m.latest),
    (
      select md.raw_steps
      from public.challenge_member_days md
      where md.challenge_id = ev.id
        and md.user_id = auth.uid()
        and md.day = coalesce(s.open_day, s.frozen_day)
    ),
    (
      select md.capped_steps
      from public.challenge_member_days md
      where md.challenge_id = ev.id
        and md.user_id = auth.uid()
        and md.day = coalesce(s.open_day, s.frozen_day)
    ),
    s.open_day is null and s.frozen_day is not null and mine is not null,
    (
      select mem.leaving_on
      from public.challenge_members mem
      where mem.challenge_id = ev.id and mem.user_id = auth.uid() and mem.left_on is null
      limit 1
    ),
    t.image::int,
    t.photo_path,
    ev.photo_path,
    ev.share_message
  from scores s
  cross join mark m
  left join public.challenge_teams t on t.id = s.team_id;
end;
$$;

revoke all on function public.get_challenge_board(text) from public;
grant execute on function public.get_challenge_board(text) to anon, authenticated;
