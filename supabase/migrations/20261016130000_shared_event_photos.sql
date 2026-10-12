-- A photo on a shared event, such as an invitation card. Anyone with the link sees it, like the event.
-- Stored at event-photos/<event id>/<random>.jpg. Set once, at the first share; switching the event off deletes it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.shared_events
  add column photo_path text,
  add constraint shared_events_photo_path check (
    photo_path is null or photo_path ~ ('^' || id::text || '/[a-z0-9-]{8,64}\.jpg$')
  );

-- Only the owner, only into an active event's own folder, and only while it has no photo.
create policy "Owners upload a photo for their shared event"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.shared_events e
      where e.id::text = (storage.foldername(name))[1]
        and e.owner_id = auth.uid()
        and e.photo_path is null
        and e.status = 'active'
    )
  );

-- The owner removes a photo that never got linked; the admin removes one when switching an event off.
create policy "Owners and admins delete shared event photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and (
      exists (
        select 1 from public.shared_events e
        where e.id::text = (storage.foldername(name))[1]
          and e.owner_id = auth.uid()
      )
      or coalesce(public.is_current_user_admin(), false)
    )
  );

-- The photo is set once by the owner. Only the admin clears it.
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
  if new.photo_path is distinct from old.photo_path
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
  photo_path text
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
    case when e.status = 'switched_off' then null else e.photo_path end
  from public.shared_events e
  where e.code = lower(btrim(p_code));
$$;

revoke all on function public.get_shared_event(text) from public;
grant execute on function public.get_shared_event(text) to anon, authenticated;

-- Copies learn the photo with the status, so a switched-off event's photo disappears from them too.
drop function public.shared_event_statuses(uuid[]);

create function public.shared_event_statuses(p_ids uuid[])
returns table (id uuid, status text, photo_path text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.status, case when e.status = 'switched_off' then null else e.photo_path end
  from public.shared_events e
  where e.id = any (p_ids[1:200]);
$$;

revoke all on function public.shared_event_statuses(uuid[]) from public;
grant execute on function public.shared_event_statuses(uuid[]) to anon, authenticated;

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
  description text,
  photo_path text
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
    e.description,
    e.photo_path
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
