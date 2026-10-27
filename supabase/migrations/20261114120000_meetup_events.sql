-- A meetup stays editable. People who already added it pick up the new day and time.
alter table public.shared_events
  add column meetup boolean not null default false,
  add column remind_before boolean not null default false;

create or replace function public.shared_events_guard_update()
returns trigger
language plpgsql
as $$
declare
  admin boolean := coalesce(auth.role(), '') = 'service_role'
    or coalesce(public.is_current_user_admin(), false);
  meetup_owner boolean := old.meetup and auth.uid() = old.owner_id;
begin
  if new.owner_id is distinct from old.owner_id
     or new.meetup is distinct from old.meetup
     or new.created_at is distinct from old.created_at
     or new.from_line is distinct from old.from_line
     or (new.kind is distinct from old.kind and not meetup_owner)
     or (new.text is distinct from old.text and not meetup_owner)
     or (new.description is distinct from old.description and not meetup_owner)
     or (new.day is distinct from old.day and not meetup_owner)
     or (new.hour is distinct from old.hour and not meetup_owner)
     or (new.minute is distinct from old.minute and not meetup_owner)
     or (new.time_zone is distinct from old.time_zone and not meetup_owner)
     or (new.remind_before is distinct from old.remind_before and not meetup_owner) then
    raise exception 'shared_events_locked' using errcode = 'P0001';
  end if;
  if new.photo_path is distinct from old.photo_path
     and not meetup_owner
     and not (old.photo_path is null and new.photo_path is not null and old.status = 'active')
     and not (admin and new.photo_path is null) then
    raise exception 'shared_events_locked' using errcode = 'P0001';
  end if;
  if not admin and new.status is distinct from old.status
     and (old.status <> 'active' or new.status <> 'cancelled') then
    raise exception 'shared_events_status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop function public.get_shared_event(text);

create function public.get_shared_event(p_code text)
returns table (
  id uuid,
  code text,
  text text,
  from_line text,
  day date,
  hour smallint,
  minute smallint,
  time_zone text,
  kind text,
  status text,
  taking_adds boolean,
  description text,
  photo_path text,
  meetup boolean,
  remind_before boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.code,
    case when e.status = 'switched_off' then null else e.text end,
    case when e.status = 'switched_off' then null else e.from_line end,
    e.day,
    e.hour,
    e.minute,
    e.time_zone,
    e.kind,
    e.status,
    e.taking_adds,
    case when e.status = 'switched_off' then null else e.description end,
    case when e.status = 'switched_off' then null else e.photo_path end,
    e.meetup,
    e.remind_before
  from public.shared_events e
  where e.code = lower(btrim(p_code));
$$;

revoke all on function public.get_shared_event(text) from public;
grant execute on function public.get_shared_event(text) to anon, authenticated;

drop function public.shared_event_statuses(uuid[]);

create function public.shared_event_statuses(p_ids uuid[])
returns table (
  id uuid,
  status text,
  photo_path text,
  meetup boolean,
  text text,
  description text,
  day date,
  hour smallint,
  minute smallint,
  time_zone text,
  remind_before boolean,
  kind text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.status,
    case when e.status = 'switched_off' then null else e.photo_path end,
    e.meetup,
    case when e.status = 'switched_off' then null else e.text end,
    case when e.status = 'switched_off' then null else e.description end,
    e.day,
    e.hour,
    e.minute,
    e.time_zone,
    e.remind_before,
    e.kind
  from public.shared_events e
  where e.id = any (p_ids[1:200]);
$$;

revoke all on function public.shared_event_statuses(uuid[]) from public;
grant execute on function public.shared_event_statuses(uuid[]) to anon, authenticated;
