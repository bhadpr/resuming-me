-- Local marketing groups. Counts are installs and return days, never a person's name or health data.
-- The app records payments. It does not send money.

create table public.marketing_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  install_goal integer not null default 1000,
  install_rate_rupees integer not null default 5,
  retained_rate_rupees integer not null default 50,
  cap_rupees integer,
  created_at timestamptz not null default now(),
  constraint marketing_groups_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint marketing_groups_goal check (install_goal >= 1),
  constraint marketing_groups_rates check (install_rate_rupees >= 0 and retained_rate_rupees >= 0),
  constraint marketing_groups_cap check (cap_rupees is null or cap_rupees >= 0)
);

create table public.marketing_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.marketing_groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  code text not null unique,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketing_members_one_seat unique (group_id, user_id)
);

create table public.marketing_installs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.marketing_groups (id) on delete cascade,
  member_id uuid references public.marketing_members (id) on delete set null,
  device_key text not null unique,
  started_on date not null,
  open_days date[] not null,
  created_at timestamptz not null default now(),
  constraint marketing_installs_device_key check (device_key ~ '^[0-9a-f]{64}$'),
  constraint marketing_installs_open_days check (cardinality(open_days) >= 1)
);

create index marketing_installs_group_idx on public.marketing_installs (group_id);
create index marketing_installs_member_idx on public.marketing_installs (member_id);

create table public.marketing_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.marketing_groups (id) on delete cascade,
  member_id uuid references public.marketing_members (id) on delete set null,
  paid_on date not null default (now() at time zone 'utc')::date,
  amount_rupees integer not null,
  note text not null default '',
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  constraint marketing_payments_amount check (amount_rupees >= 0),
  constraint marketing_payments_note_len check (char_length(note) <= 500)
);

create or replace function public.marketing_new_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  candidate text;
  i int;
  attempt int;
begin
  for attempt in 1..12 loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.marketing_groups where code = candidate)
       and not exists (select 1 from public.marketing_members where code = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'could not allocate a marketing code';
end;
$$;

create or replace function public.marketing_groups_assign_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.marketing_new_code();
  end if;
  return new;
end;
$$;

create trigger marketing_groups_assign_code
  before insert on public.marketing_groups
  for each row execute function public.marketing_groups_assign_code();

create or replace function public.marketing_members_assign_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.marketing_new_code();
  end if;
  return new;
end;
$$;

create trigger marketing_members_assign_code
  before insert on public.marketing_members
  for each row execute function public.marketing_members_assign_code();

create or replace function public.marketing_counts(
  p_group_id uuid,
  p_member_id uuid,
  p_as_of date
)
returns table (
  installs integer,
  in_progress integer,
  retained integer,
  ended_short integer
)
language sql
stable
as $$
  select
    count(*)::integer,
    count(*) filter (
      where cardinality(open_days) < 5
        and p_as_of <= started_on + 29
    )::integer,
    count(*) filter (where cardinality(open_days) >= 5)::integer,
    count(*) filter (
      where cardinality(open_days) < 5
        and p_as_of > started_on + 29
    )::integer
  from public.marketing_installs
  where group_id = p_group_id
    and (p_member_id is null or member_id = p_member_id);
$$;

-- First open tags the device. Later opens on new days fill the 30-day window.
-- A date far from the server date is ignored, so one call cannot invent five days.
create or replace function public.marketing_record_open(
  p_device_key text,
  p_group_code text,
  p_member_code text,
  p_opened_on date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_install public.marketing_installs%rowtype;
  v_member_id uuid;
  v_group_id uuid;
begin
  if p_device_key is null or p_device_key !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  if p_opened_on is null
     or p_opened_on < (current_date - 1)
     or p_opened_on > (current_date + 1) then
    return;
  end if;

  select * into v_install
  from public.marketing_installs
  where device_key = p_device_key;

  if found then
    if p_opened_on < v_install.started_on or p_opened_on > v_install.started_on + 29 then
      return;
    end if;
    if p_opened_on = any (v_install.open_days) then
      return;
    end if;
    update public.marketing_installs
      set open_days = open_days || p_opened_on
      where id = v_install.id;
    return;
  end if;

  if p_group_code is null or btrim(p_group_code) = ''
     or p_member_code is null or btrim(p_member_code) = '' then
    return;
  end if;

  select m.id, m.group_id
    into v_member_id, v_group_id
  from public.marketing_members m
  join public.marketing_groups g on g.id = m.group_id
  where m.code = p_member_code
    and g.code = p_group_code
    and m.removed_at is null;

  if v_member_id is null then
    return;
  end if;

  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  values (v_group_id, v_member_id, p_device_key, p_opened_on, array[p_opened_on]);
exception
  when unique_violation then
    return;
end;
$$;

create or replace function public.marketing_add_member(p_group_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_id uuid;
begin
  if not public.is_current_user_admin() then
    raise exception 'not allowed';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Enter the email on their Resuming account';
  end if;
  if not exists (select 1 from public.marketing_groups where id = p_group_id) then
    raise exception 'Group not found';
  end if;

  select id into v_user
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user is null then
    raise exception 'No account with that email has signed in yet';
  end if;

  select id into v_id
  from public.marketing_members
  where group_id = p_group_id and user_id = v_user;

  if v_id is not null then
    update public.marketing_members
      set removed_at = null,
          email = v_email
      where id = v_id;
    return v_id;
  end if;

  insert into public.marketing_members (group_id, user_id, email)
  values (p_group_id, v_user, v_email)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.marketing_my_stats(p_as_of date)
returns table (
  group_id uuid,
  group_name text,
  group_code text,
  member_code text,
  install_goal integer,
  group_installs integer,
  group_in_progress integer,
  group_retained integer,
  group_ended_short integer,
  my_installs integer,
  my_in_progress integer,
  my_retained integer,
  my_ended_short integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    g.id,
    g.name,
    g.code,
    m.code,
    g.install_goal,
    c.installs,
    c.in_progress,
    c.retained,
    c.ended_short,
    mine.installs,
    mine.in_progress,
    mine.retained,
    mine.ended_short
  from public.marketing_members m
  join public.marketing_groups g on g.id = m.group_id
  cross join lateral public.marketing_counts(g.id, null, p_as_of) c
  cross join lateral public.marketing_counts(g.id, m.id, p_as_of) mine
  where m.user_id = auth.uid()
    and m.removed_at is null
  order by g.name;
end;
$$;

alter table public.marketing_groups enable row level security;
alter table public.marketing_members enable row level security;
alter table public.marketing_installs enable row level security;
alter table public.marketing_payments enable row level security;

create policy "Admins manage marketing groups"
  on public.marketing_groups for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins manage marketing members"
  on public.marketing_members for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "Admins read marketing installs"
  on public.marketing_installs for select
  to authenticated
  using (public.is_current_user_admin());

create policy "Admins manage marketing payments"
  on public.marketing_payments for all
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

revoke all on function public.marketing_new_code() from public;
revoke all on function public.marketing_counts(uuid, uuid, date) from public;
revoke all on function public.marketing_record_open(text, text, text, date) from public;
revoke all on function public.marketing_add_member(uuid, text) from public;
revoke all on function public.marketing_my_stats(date) from public;

create or replace function public.marketing_admin_counts(p_as_of date)
returns table (
  group_id uuid,
  member_id uuid,
  installs integer,
  in_progress integer,
  retained integer,
  ended_short integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    return;
  end if;

  return query
  select
    i.group_id,
    i.member_id,
    count(*)::integer,
    count(*) filter (
      where cardinality(i.open_days) < 5
        and p_as_of <= i.started_on + 29
    )::integer,
    count(*) filter (where cardinality(i.open_days) >= 5)::integer,
    count(*) filter (
      where cardinality(i.open_days) < 5
        and p_as_of > i.started_on + 29
    )::integer
  from public.marketing_installs i
  group by i.group_id, i.member_id;
end;
$$;

revoke all on function public.marketing_admin_counts(date) from public;
grant execute on function public.marketing_admin_counts(date) to authenticated;

grant execute on function public.marketing_record_open(text, text, text, date) to anon, authenticated;
grant execute on function public.marketing_add_member(uuid, text) to authenticated;
grant execute on function public.marketing_my_stats(date) to authenticated;
