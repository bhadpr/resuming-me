-- A challenge stays on Today through the day it finishes, and leaves the next day.
-- Ending early records that day. A challenge that runs out its dates uses the last day.

begin;

alter table public.challenges
  add column if not exists ended_on date;

update public.challenges
set ended_on = least(ends_on, (now() at time zone time_zone)::date)
where status = 'ended'
  and ended_on is null;

create or replace function public.end_walking_challenge(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.challenges%rowtype;
begin
  if uid is null then
    raise exception 'challenge_sign_in' using errcode = 'P0001';
  end if;
  select * into ev from public.challenges where id = p_id;
  if not found or ev.owner_id <> uid or ev.status <> 'active' then
    raise exception 'challenge_not_owner' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.challenge_members m
    where m.challenge_id = ev.id and m.user_id <> uid
  ) then
    raise exception 'challenge_end_blocked' using errcode = 'P0001';
  end if;
  perform public.freeze_walking_challenge(ev.id);
  update public.challenges
  set status = 'ended',
      ended_on = (now() at time zone ev.time_zone)::date
  where id = ev.id;
end;
$$;

create or replace function public.my_challenge_index()
returns table (
  role text,
  code text,
  title text,
  card_path text,
  kind text,
  starts_on date,
  ends_on date,
  phase text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  return query
  select
    'member'::text,
    c.code,
    c.title,
    c.photo_path,
    c.kind,
    c.starts_on,
    c.ends_on,
    case
      when (now() at time zone c.time_zone)::date > coalesce(c.ended_on, c.ends_on)
        then 'past'
      when (now() at time zone c.time_zone)::date < c.starts_on
        and c.starts_on <= (now() at time zone c.time_zone)::date + 2
        then 'soon'
      when (now() at time zone c.time_zone)::date < c.starts_on
        then 'later'
      else 'current'
    end
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = uid
    and m.left_on is null
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind in ('walk', 'meditate')
  order by c.ends_on desc, c.created_at;

  return query
  select
    'run'::text,
    c.code,
    c.title,
    c.photo_path,
    c.kind,
    c.starts_on,
    c.ends_on,
    case
      when (now() at time zone c.time_zone)::date > coalesce(c.ended_on, c.ends_on)
        then 'past'
      when (now() at time zone c.time_zone)::date < c.starts_on
        and c.starts_on <= (now() at time zone c.time_zone)::date + 2
        then 'soon'
      when (now() at time zone c.time_zone)::date < c.starts_on
        then 'later'
      else 'current'
    end
  from public.challenges c
  where c.owner_id = uid
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind in ('walk', 'meditate')
    and not exists (
      select 1 from public.challenge_members m
      where m.challenge_id = c.id and m.user_id = uid and m.left_on is null
    )
  order by c.ends_on desc, c.created_at;
end;
$$;

revoke all on function public.my_challenge_index() from public;
grant execute on function public.my_challenge_index() to authenticated;
revoke all on function public.end_walking_challenge(uuid) from public;
grant execute on function public.end_walking_challenge(uuid) to authenticated;

commit;
