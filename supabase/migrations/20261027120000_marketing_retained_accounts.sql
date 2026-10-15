-- Referral groups: a retained person has an account (P15-15, decision 8).
--
-- Before: an install counted as retained when its device opened the app on five different days
-- within 30, with or without an account.
-- Now: it counts only when the install is also linked to a signed-in account.
--
-- The link is made on the server. marketing_record_open is called by the app on the first open
-- of each day. When the caller is signed in, the install record gets that account's id from the
-- login token (auth.uid()), never from a value the caller sends. A first open is usually signed
-- out, so the link is made on the next day's open after sign-in, inside the 30-day window.
--
-- One account is linked to at most one install, so the same person on two phones, or reinstalling,
-- is paid once. If the account is deleted the link is removed (the install still counts, the
-- retained person does not).

alter table public.marketing_installs
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists marketing_installs_user_key
  on public.marketing_installs (user_id)
  where user_id is not null;

-- The one definition of "retained", used by every count below.
create or replace function public.marketing_is_retained(p_user uuid, p_open_days date[])
returns boolean
language sql
immutable
as $$
  select p_user is not null and cardinality(p_open_days) >= 5;
$$;

-- Installs that are not retained yet stay "in progress" until their 30 days end, even if the
-- device already has five days but no account, so installs = in_progress + retained + ended_short.
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
      where not public.marketing_is_retained(user_id, open_days)
        and p_as_of <= started_on + 29
    )::integer,
    count(*) filter (where public.marketing_is_retained(user_id, open_days))::integer,
    count(*) filter (
      where not public.marketing_is_retained(user_id, open_days)
        and p_as_of > started_on + 29
    )::integer
  from public.marketing_installs
  where group_id = p_group_id
    and (p_member_id is null or member_id = p_member_id);
$$;

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
      where not public.marketing_is_retained(i.user_id, i.open_days)
        and p_as_of <= i.started_on + 29
    )::integer,
    count(*) filter (where public.marketing_is_retained(i.user_id, i.open_days))::integer,
    count(*) filter (
      where not public.marketing_is_retained(i.user_id, i.open_days)
        and p_as_of > i.started_on + 29
    )::integer
  from public.marketing_installs i
  group by i.group_id, i.member_id;
end;
$$;

create or replace function public.marketing_admin_settled(p_as_of date, p_hold_days integer default 7)
returns table (group_id uuid, installs integer, retained integer)
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
    count(*)::integer,
    count(*) filter (where public.marketing_is_retained(i.user_id, i.open_days))::integer
  from public.marketing_installs i
  where p_as_of >= i.started_on + 29 + greatest(coalesce(p_hold_days, 0), 0)
  group by i.group_id;
end;
$$;

-- Same flags as before. high_return now measures people with an account and five days.
create or replace function public.marketing_admin_flags(p_as_of date)
returns table (group_id uuid, member_id uuid, kind text, detail text, flagged_on date)
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
  with daily as (
    select i.group_id, i.member_id, i.started_on as day, count(*)::integer as n
    from public.marketing_installs i
    group by i.group_id, i.member_id, i.started_on
  ),
  totals as (
    select d.group_id, d.member_id, sum(d.n)::integer as total, min(d.day) as first_day
    from daily d
    group by d.group_id, d.member_id
  ),
  spikes as (
    select
      d.group_id,
      d.member_id,
      'spike'::text as kind,
      d.n::text || ' installs on one day, about '
        || round(d.n / greatest(1, (t.total - d.n)::numeric / greatest(1, (p_as_of - t.first_day + 1) - 1)))::text
        || ' times the usual day' as detail,
      d.day as flagged_on
    from daily d
    join totals t
      on t.group_id = d.group_id
     and t.member_id is not distinct from d.member_id
    where d.n >= 25
      and d.n >= 5 * greatest(1, (t.total - d.n)::numeric / greatest(1, (p_as_of - t.first_day + 1) - 1))
  ),
  closed as (
    select
      i.group_id,
      i.member_id,
      count(*)::integer as installs,
      count(*) filter (where public.marketing_is_retained(i.user_id, i.open_days))::integer as retained
    from public.marketing_installs i
    where p_as_of > i.started_on + 29
    group by i.group_id, i.member_id
  ),
  high_return as (
    select
      c.group_id,
      c.member_id,
      'high_return'::text as kind,
      c.retained::text || ' of ' || c.installs::text || ' people ('
        || round(100.0 * c.retained / c.installs)::text
        || '%) have an account and opened on five days, which is unusually high' as detail,
      null::date as flagged_on
    from closed c
    where c.installs >= 20
      and c.retained::numeric / c.installs >= 0.7
  )
  select s.group_id, s.member_id, s.kind, s.detail, s.flagged_on from spikes s
  union all
  select h.group_id, h.member_id, h.kind, h.detail, h.flagged_on from high_return h;
end;
$$;

-- First open tags the device. Later opens on new days fill the 30-day window. A signed-in
-- caller also links its account to the install (once, inside the window).
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
  v_user uuid := auth.uid();
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

    -- Link the account. An account that already belongs to another install is left alone.
    if v_user is not null and v_install.user_id is null then
      begin
        update public.marketing_installs
          set user_id = v_user
          where id = v_install.id and user_id is null;
      exception
        when unique_violation then
          null;
      end;
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

  begin
    insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days, user_id)
    values (v_group_id, v_member_id, p_device_key, p_opened_on, array[p_opened_on], v_user);
  exception
    when unique_violation then
      -- The account is already linked to another install: record this install without it.
      insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
      values (v_group_id, v_member_id, p_device_key, p_opened_on, array[p_opened_on]);
  end;
exception
  when unique_violation then
    return;
end;
$$;

-- Account deletion also removes the link (the foreign key does the same if the user row goes).
create or replace function public.erase_user_usage(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;

  delete from public.events
  where user_id = p_user
     or anon_id in (
       select distinct anon_id from public.events where user_id = p_user
     );

  update public.marketing_installs
  set user_id = null
  where user_id = p_user;

  -- The seat stays so counts and payments are kept, but it no longer holds a person's email
  -- and its link stops earning installs.
  update public.marketing_members
  set email = '(deleted account)',
      removed_at = coalesce(removed_at, now())
  where user_id = p_user;
end;
$$;

revoke all on function public.marketing_is_retained(uuid, date[]) from public;
revoke all on function public.erase_user_usage(uuid) from public, anon, authenticated;
grant execute on function public.erase_user_usage(uuid) to service_role;
