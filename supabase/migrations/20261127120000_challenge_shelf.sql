-- Today keeps a challenge only while its dates include today.
-- A finished challenge, and one starting within two days, stays on Habits or Health.

begin;

drop function public.my_challenge_index();

create function public.my_challenge_index()
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
      when c.status = 'ended'
        or (now() at time zone c.time_zone)::date > c.ends_on
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
      when c.status = 'ended'
        or (now() at time zone c.time_zone)::date > c.ends_on
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

commit;
