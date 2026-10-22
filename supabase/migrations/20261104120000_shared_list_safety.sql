-- Who accepted a list, and reports. One row per account or per guest device.
-- The row stores an account id or an anonymous device id. It does not store a name.

create table public.shared_list_accepts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  device_id text,
  created_at timestamptz not null default now(),
  constraint shared_list_accepts_one_who check ((user_id is null) <> (device_id is null)),
  constraint shared_list_accepts_device_len check (device_id is null or char_length(device_id) between 8 and 80)
);

create unique index shared_list_accepts_user_idx
  on public.shared_list_accepts (list_id, user_id) where user_id is not null;
create unique index shared_list_accepts_device_idx
  on public.shared_list_accepts (list_id, device_id) where device_id is not null;

alter table public.shared_list_accepts enable row level security;

create table public.shared_list_reports (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  reason text not null,
  user_id uuid references auth.users (id) on delete set null,
  device_id text,
  created_at timestamptz not null default now(),
  constraint shared_list_reports_reason check (reason in ('spam', 'harmful', 'other')),
  constraint shared_list_reports_device_len check (device_id is null or char_length(device_id) between 8 and 80)
);

create unique index shared_list_reports_user_idx
  on public.shared_list_reports (list_id, user_id) where user_id is not null;
create unique index shared_list_reports_device_idx
  on public.shared_list_reports (list_id, device_id) where user_id is null and device_id is not null;

alter table public.shared_list_reports enable row level security;

-- Signed in: count the account, and turn this device's guest accept into it.
-- Guest: count the device. A second accept does not add a second row.
create or replace function public.accept_shared_list(p_list_id uuid, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lst public.shared_lists%rowtype;
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  select * into lst from public.shared_lists where id = p_list_id;
  if not found then
    raise exception 'shared_list_unavailable' using errcode = 'P0001';
  end if;

  if uid is not null and device is not null and exists (
    select 1 from public.shared_list_accepts where list_id = lst.id and device_id = device
  ) then
    delete from public.shared_list_accepts where list_id = lst.id and device_id = device;
    insert into public.shared_list_accepts (list_id, user_id)
    values (lst.id, uid)
    on conflict do nothing;
    return;
  end if;

  if lst.status <> 'active' then
    raise exception 'shared_list_unavailable' using errcode = 'P0001';
  end if;

  if uid is not null then
    insert into public.shared_list_accepts (list_id, user_id)
    values (lst.id, uid)
    on conflict do nothing;
    return;
  end if;

  if device is null or char_length(device) not between 8 and 80 then
    raise exception 'shared_list_device' using errcode = 'P0001';
  end if;
  insert into public.shared_list_accepts (list_id, device_id)
  values (lst.id, device)
  on conflict do nothing;
end;
$$;

-- At sign-in, this device's guest accepts become the account, so one person counts once.
create or replace function public.claim_shared_list_accepts(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if device is null or char_length(device) not between 8 and 80 then
    return;
  end if;
  with moved as (
    delete from public.shared_list_accepts
    where device_id = device
    returning list_id
  )
  insert into public.shared_list_accepts (list_id, user_id)
  select moved.list_id, uid from moved
  on conflict do nothing;
end;
$$;

create or replace function public.report_shared_list(p_list_id uuid, p_reason text, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  device text := nullif(btrim(coalesce(p_device_id, '')), '');
begin
  if not exists (select 1 from public.shared_lists where id = p_list_id) then
    raise exception 'shared_list_unavailable' using errcode = 'P0001';
  end if;
  if uid is null and (device is null or char_length(device) not between 8 and 80) then
    raise exception 'shared_list_device' using errcode = 'P0001';
  end if;
  insert into public.shared_list_reports (list_id, reason, user_id, device_id)
  values (p_list_id, p_reason, uid, case when uid is null then device end)
  on conflict do nothing;
end;
$$;

-- Counts only. No account ids and no device ids leave this function.
create or replace function public.admin_shared_list_stats()
returns table (
  list_id uuid,
  accepts bigint,
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
    l.id,
    (select count(*) from public.shared_list_accepts a where a.list_id = l.id),
    count(r.id),
    count(r.id) filter (where r.reason = 'spam'),
    count(r.id) filter (where r.reason = 'harmful'),
    count(r.id) filter (where r.reason = 'other')
  from public.shared_lists l
  left join public.shared_list_reports r on r.list_id = l.id
  group by l.id;
end;
$$;

revoke all on function public.accept_shared_list(uuid, text) from public;
revoke all on function public.claim_shared_list_accepts(text) from public;
revoke all on function public.report_shared_list(uuid, text, text) from public;
revoke all on function public.admin_shared_list_stats() from public;
grant execute on function public.accept_shared_list(uuid, text) to anon, authenticated;
grant execute on function public.claim_shared_list_accepts(text) to authenticated;
grant execute on function public.report_shared_list(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_shared_list_stats() to authenticated;
