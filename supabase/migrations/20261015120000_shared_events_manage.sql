-- Shared events, part 2: copies learn about cancel and switch-off, the organizer sees a count
-- and can close or reset the link, anyone can report, and the admin can switch an event off.

-- A follower can turn off one reminder's alert without removing it.
alter table public.reminders
  add column alert_off boolean not null default false;

-- Codes replaced by a reset. Never handed out again; their links find nothing.
create table public.shared_event_retired_codes (
  code text primary key,
  event_id uuid not null references public.shared_events (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  retired_at timestamptz not null default now()
);

create index shared_event_retired_codes_owner_idx
  on public.shared_event_retired_codes (owner_id, retired_at desc);

alter table public.shared_event_retired_codes enable row level security;

-- New links and resets share the limit of 10 a day.
create or replace function public.shared_events_links_today(p_owner uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.shared_events
     where owner_id = p_owner and created_at > now() - interval '24 hours')
    + (select count(*) from public.shared_event_retired_codes
       where owner_id = p_owner and retired_at > now() - interval '24 hours')
  where p_owner = coalesce(auth.uid(), p_owner);
$$;

revoke all on function public.shared_events_links_today(uuid) from public;
grant execute on function public.shared_events_links_today(uuid) to authenticated;

create or replace function public.shared_event_code_retired(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.shared_event_retired_codes where code = p_code);
$$;

revoke all on function public.shared_event_code_retired(text) from public;
grant execute on function public.shared_event_code_retired(text) to authenticated;

create or replace function public.shared_events_check_insert()
returns trigger
language plpgsql
as $$
begin
  if public.shared_events_links_today(new.owner_id) >= 10 then
    raise exception 'shared_events_daily_cap' using errcode = 'P0001';
  end if;
  if new.day < current_date - 1 then
    raise exception 'shared_events_past_day' using errcode = 'P0001';
  end if;
  while public.shared_event_code_retired(new.code) loop
    new.code := public.shared_event_new_code();
  end loop;
  return new;
end;
$$;

-- Codes change only through reset_shared_event_code, so every old code is retired and counted.
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
     or new.from_line is distinct from old.from_line
     or new.day is distinct from old.day
     or new.hour is distinct from old.hour
     or new.minute is distinct from old.minute
     or new.time_zone is distinct from old.time_zone
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'shared_events_locked' using errcode = 'P0001';
  end if;
  if new.code is distinct from old.code
     and coalesce(current_setting('resuming.code_reset', true), '') <> 'on' then
    raise exception 'shared_events_locked' using errcode = 'P0001';
  end if;
  if not admin and new.status is distinct from old.status
     and (old.status <> 'active' or new.status <> 'cancelled') then
    raise exception 'shared_events_status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Status of the events behind someone's copies. Status only, nothing else.
create or replace function public.shared_event_statuses(p_ids uuid[])
returns table (id uuid, status text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.status
  from public.shared_events e
  where e.id = any (p_ids[1:200]);
$$;

-- The organizer's view of their own event, with how many added it.
create or replace function public.my_shared_event(p_event_id uuid)
returns table (
  id uuid,
  code text,
  from_line text,
  status text,
  taking_adds boolean,
  followers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.code,
    e.from_line,
    e.status,
    e.taking_adds,
    (select count(*) from public.shared_event_followers f where f.event_id = e.id)
  from public.shared_events e
  where e.id = p_event_id
    and (e.owner_id = auth.uid() or coalesce(public.is_current_user_admin(), false));
$$;

-- Removing a copy ends the follow, for the account and for this device.
create or replace function public.unfollow_shared_event(p_event_id uuid, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  if uid is not null then
    delete from public.shared_event_followers where event_id = p_event_id and user_id = uid;
  end if;
  if device is not null then
    delete from public.shared_event_followers where event_id = p_event_id and device_id = device;
  end if;
end;
$$;

-- A new code for the same event. The old link stops working; followers keep their copies.
create or replace function public.reset_shared_event_code(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.shared_events%rowtype;
  next_code text;
begin
  select * into ev from public.shared_events where id = p_event_id and owner_id = uid for update;
  if not found then
    raise exception 'shared_event_unavailable' using errcode = 'P0001';
  end if;
  if ev.status <> 'active' then
    raise exception 'shared_events_status' using errcode = 'P0001';
  end if;
  if public.shared_events_links_today(uid) >= 10 then
    raise exception 'shared_events_daily_cap' using errcode = 'P0001';
  end if;
  loop
    next_code := public.shared_event_new_code();
    exit when not exists (select 1 from public.shared_events where code = next_code)
      and not exists (select 1 from public.shared_event_retired_codes where code = next_code);
  end loop;
  insert into public.shared_event_retired_codes (code, event_id, owner_id) values (ev.code, ev.id, uid);
  perform set_config('resuming.code_reset', 'on', true);
  update public.shared_events set code = next_code where id = ev.id;
  perform set_config('resuming.code_reset', 'off', true);
  return next_code;
end;
$$;

-- Reports. One per account or device per event.
create table public.shared_event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shared_events (id) on delete cascade,
  reason text not null,
  user_id uuid references auth.users (id) on delete set null,
  device_id text,
  created_at timestamptz not null default now(),
  constraint shared_event_reports_reason check (reason in ('spam', 'harmful', 'other')),
  constraint shared_event_reports_device_len check (device_id is null or char_length(device_id) between 8 and 80)
);

create unique index shared_event_reports_user_idx
  on public.shared_event_reports (event_id, user_id) where user_id is not null;
create unique index shared_event_reports_device_idx
  on public.shared_event_reports (event_id, device_id) where user_id is null and device_id is not null;

alter table public.shared_event_reports enable row level security;

create or replace function public.report_shared_event(p_event_id uuid, p_reason text, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  if not exists (select 1 from public.shared_events where id = p_event_id) then
    raise exception 'shared_event_unavailable' using errcode = 'P0001';
  end if;
  if uid is null and (device is null or char_length(device) not between 8 and 80) then
    raise exception 'shared_event_device' using errcode = 'P0001';
  end if;
  insert into public.shared_event_reports (event_id, reason, user_id, device_id)
  values (p_event_id, p_reason, uid, case when uid is null then device end)
  on conflict do nothing;
end;
$$;

-- The admin list: reported events first, then the newest.
create or replace function public.admin_shared_events()
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
  other bigint
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
    count(r.id) filter (where r.reason = 'other')
  from public.shared_events e
  left join public.shared_event_reports r on r.event_id = e.id
  group by e.id
  order by count(r.id) desc, e.created_at desc
  limit 200;
end;
$$;

revoke all on function public.shared_event_statuses(uuid[]) from public;
revoke all on function public.my_shared_event(uuid) from public;
revoke all on function public.unfollow_shared_event(uuid, text) from public;
revoke all on function public.reset_shared_event_code(uuid) from public;
revoke all on function public.report_shared_event(uuid, text, text) from public;
revoke all on function public.admin_shared_events() from public;
grant execute on function public.shared_event_statuses(uuid[]) to anon, authenticated;
grant execute on function public.my_shared_event(uuid) to authenticated;
grant execute on function public.unfollow_shared_event(uuid, text) to anon, authenticated;
grant execute on function public.reset_shared_event_code(uuid) to authenticated;
grant execute on function public.report_shared_event(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_shared_events() to authenticated;
