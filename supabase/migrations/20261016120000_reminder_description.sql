-- A plain-text description on a reminder, and on the shared event made from it.
-- Shown as text, never as links. A shared event refuses web links, like its name.

alter table public.reminders
  add column description text,
  add constraint reminders_description_len
    check (description is null or char_length(btrim(description)) between 1 and 500);

alter table public.shared_events
  add column description text,
  add constraint shared_events_description_len
    check (description is null or char_length(btrim(description)) between 1 and 500);

alter table public.shared_events drop constraint shared_events_no_links;
alter table public.shared_events
  add constraint shared_events_no_links check (
    not public.has_web_link(text)
    and not public.has_web_link(from_line)
    and not public.has_web_link(description)
  );

-- Same rules as before, with the description fixed too.
create or replace function public.shared_events_guard_update()
returns trigger
language plpgsql
as $$
declare
  admin boolean := coalesce(auth.role(), '') = 'service_role'
    or coalesce(public.is_current_user_admin(), false);
begin
  if new.owner_id is distinct from old.owner_id
     or new.text is distinct from old.text
     or new.description is distinct from old.description
     or new.from_line is distinct from old.from_line
     or new.day is distinct from old.day
     or new.hour is distinct from old.hour
     or new.minute is distinct from old.minute
     or new.time_zone is distinct from old.time_zone
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'shared_events_locked' using errcode = 'P0001';
  end if;
  if not admin and new.status is distinct from old.status
     and (old.status <> 'active' or new.status <> 'cancelled') then
    raise exception 'shared_events_status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- The returned columns change, so the functions are dropped and made again.
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
  description text
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
    case when e.status = 'switched_off' then null else e.description end
  from public.shared_events e
  where e.code = lower(btrim(p_code));
$$;

revoke all on function public.get_shared_event(text) from public;
grant execute on function public.get_shared_event(text) to anon, authenticated;

drop function public.admin_shared_events();

create function public.admin_shared_events()
returns table (
  id uuid,
  code text,
  text text,
  from_line text,
  day date,
  status text,
  taking_adds boolean,
  created_at timestamptz,
  followers bigint,
  reports bigint,
  spam bigint,
  harmful bigint,
  other bigint,
  description text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'not admin' using errcode = '42501';
  end if;
  return query
  select
    e.id,
    e.code,
    e.text,
    e.from_line,
    e.day,
    e.status,
    e.taking_adds,
    e.created_at,
    (select count(*) from public.shared_event_followers f where f.event_id = e.id),
    count(r.id),
    count(r.id) filter (where r.reason = 'spam'),
    count(r.id) filter (where r.reason = 'harmful'),
    count(r.id) filter (where r.reason = 'other'),
    e.description
  from public.shared_events e
  left join public.shared_event_reports r on r.event_id = e.id
  group by e.id
  order by count(r.id) desc, e.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_shared_events() from public;
revoke execute on function public.admin_shared_events() from anon;
grant execute on function public.admin_shared_events() to authenticated;
