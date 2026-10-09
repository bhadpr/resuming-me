-- Shared events (Phase 8): a one-day reminder that many people follow from one link.
-- Anyone with the code can read the event. Only the owner and the admin see who owns it or how many follow.
-- Text, From line, day, and time are fixed once the row exists.

create or replace function public.has_web_link(value text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    value ~* '(https?:|www\.|[a-z0-9-]+\.(com|in|net|org|me|io|co|info|xyz|app|link|ly|gl|to|site|online|shop|club|top|live|store|click)(?![a-z0-9]))',
    false
  );
$$;

-- Six characters without 0/o, 1/l/i, so a code read aloud is still right.
create or replace function public.shared_event_new_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return code;
end;
$$;

create table public.shared_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.shared_event_new_code(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  from_line text,
  day date not null,
  hour smallint,
  minute smallint,
  time_zone text not null,
  kind text not null default 'other',
  status text not null default 'active',
  taking_adds boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_events_code_format check (code ~ '^[a-z0-9]{6,12}$'),
  constraint shared_events_text_len check (char_length(btrim(text)) between 1 and 120),
  constraint shared_events_from_len check (from_line is null or char_length(btrim(from_line)) between 1 and 60),
  constraint shared_events_no_links check (not public.has_web_link(text) and not public.has_web_link(from_line)),
  constraint shared_events_hour check (hour between 0 and 23),
  constraint shared_events_minute check (minute between 0 and 59),
  constraint shared_events_time_pair check ((hour is null) = (minute is null)),
  constraint shared_events_time_zone_len check (char_length(time_zone) between 1 and 64),
  constraint shared_events_kind check (kind in ('errand', 'bill', 'doctor', 'event', 'other')),
  constraint shared_events_status check (status in ('active', 'cancelled', 'switched_off'))
);

create index shared_events_owner_created_idx on public.shared_events (owner_id, created_at desc);

create trigger shared_events_set_updated_at
  before update on public.shared_events
  for each row execute function public.set_updated_at();

-- At most 10 new links per account in a day, and never for a day already gone.
create or replace function public.shared_events_check_insert()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.shared_events
    where owner_id = new.owner_id and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'shared_events_daily_cap' using errcode = 'P0001';
  end if;
  if new.day < current_date - 1 then
    raise exception 'shared_events_past_day' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger shared_events_check_insert
  before insert on public.shared_events
  for each row execute function public.shared_events_check_insert();

-- The owner may cancel, open or close new adds, and later reset the code. Nothing else changes.
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
  if not admin and new.status is distinct from old.status
     and (old.status <> 'active' or new.status <> 'cancelled') then
    raise exception 'shared_events_status' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger shared_events_guard_update
  before update on public.shared_events
  for each row execute function public.shared_events_guard_update();

alter table public.shared_events enable row level security;

create policy "Owners can view own shared events"
  on public.shared_events for select using (auth.uid() = owner_id);

create policy "Owners can create shared events"
  on public.shared_events for insert
  with check (auth.uid() = owner_id and status = 'active');

create policy "Owners can update own shared events"
  on public.shared_events for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Admins can view shared events"
  on public.shared_events for select using (public.is_current_user_admin());

create policy "Admins can update shared events"
  on public.shared_events for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

-- One account or one guest device per event. No name, no phone number.
create table public.shared_event_followers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shared_events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  device_id text,
  created_at timestamptz not null default now(),
  constraint shared_event_followers_one_who check ((user_id is null) <> (device_id is null)),
  constraint shared_event_followers_device_len check (device_id is null or char_length(device_id) between 8 and 80)
);

create unique index shared_event_followers_user_idx
  on public.shared_event_followers (event_id, user_id) where user_id is not null;
create unique index shared_event_followers_device_idx
  on public.shared_event_followers (event_id, device_id) where device_id is not null;

-- Rows are only written through follow_shared_event, and only counted (later) through owner functions.
alter table public.shared_event_followers enable row level security;

-- A person's copy is their own reminder that points back to the event.
alter table public.reminders
  add column shared_event_id uuid references public.shared_events (id) on delete set null;

create unique index reminders_user_shared_event_idx
  on public.reminders (user_id, shared_event_id) where shared_event_id is not null;

-- What the event page and the app may show. A switched-off event keeps its words hidden.
create or replace function public.get_shared_event(p_code text)
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
  taking_adds boolean
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
    e.taking_adds
  from public.shared_events e
  where e.code = lower(btrim(p_code));
$$;

-- Signed in: follow as the account, and turn this device's guest follow into it.
-- Guest: follow as the device.
create or replace function public.follow_shared_event(p_event_id uuid, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.shared_events%rowtype;
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  select * into ev from public.shared_events where id = p_event_id;
  if not found then
    raise exception 'shared_event_unavailable' using errcode = 'P0001';
  end if;

  if uid is not null and device is not null and exists (
    select 1 from public.shared_event_followers where event_id = ev.id and device_id = device
  ) then
    delete from public.shared_event_followers where event_id = ev.id and device_id = device;
    if uid <> ev.owner_id then
      insert into public.shared_event_followers (event_id, user_id)
      values (ev.id, uid)
      on conflict do nothing;
    end if;
    return;
  end if;

  if ev.status <> 'active' then
    raise exception 'shared_event_unavailable' using errcode = 'P0001';
  end if;
  if not ev.taking_adds then
    raise exception 'shared_event_closed' using errcode = 'P0001';
  end if;
  if ev.day < current_date - 1 then
    raise exception 'shared_event_ended' using errcode = 'P0001';
  end if;

  if uid is not null then
    if uid = ev.owner_id then
      return;
    end if;
    insert into public.shared_event_followers (event_id, user_id)
    values (ev.id, uid)
    on conflict do nothing;
    return;
  end if;

  if device is null or char_length(device) not between 8 and 80 then
    raise exception 'shared_event_device' using errcode = 'P0001';
  end if;
  insert into public.shared_event_followers (event_id, device_id)
  values (ev.id, device)
  on conflict do nothing;
end;
$$;

revoke all on function public.get_shared_event(text) from public;
revoke all on function public.follow_shared_event(uuid, text) from public;
grant execute on function public.get_shared_event(text) to anon, authenticated;
grant execute on function public.follow_shared_event(uuid, text) to anon, authenticated;
