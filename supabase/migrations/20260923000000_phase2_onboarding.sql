-- Phase 2: guest draft merge, activity notes, and day 2/3/7 check-ins.

alter table public.profiles
  add column if not exists reminder_time text,
  add column if not exists slip_answer jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists merged_guest_id text,
  add column if not exists checkins_opt_out boolean not null default false,
  add column if not exists checkin_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_merged_guest_id_key
  on public.profiles (merged_guest_id)
  where merged_guest_id is not null;

create unique index if not exists profiles_checkin_token_key
  on public.profiles (checkin_token);

alter table public.activities
  add column if not exists why_matters text,
  add column if not exists usually_when text;

alter table public.activities
  drop constraint if exists activities_why_matters_len;
alter table public.activities
  add constraint activities_why_matters_len
  check (why_matters is null or char_length(why_matters) <= 80);

alter table public.activities
  drop constraint if exists activities_usually_when_len;
alter table public.activities
  add constraint activities_usually_when_len
  check (usually_when is null or char_length(usually_when) <= 40);

create table if not exists public.checkin_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_n integer not null check (day_n in (2, 3, 7)),
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (user_id, day_n)
);

alter table public.checkin_deliveries enable row level security;

drop policy if exists "Users can view own check-ins" on public.checkin_deliveries;
create policy "Users can view own check-ins"
  on public.checkin_deliveries for select
  using (auth.uid() = user_id);

create or replace function public.merge_guest_draft(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid text;
  existing text;
  act jsonb;
  logrow jsonb;
  n int := 0;
  aid uuid;
  lid text;
  id_map jsonb := '{}'::jsonb;
  started timestamptz;
  log_date date;
  v_type text;
  v_deadline date;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  gid := nullif(trim(coalesce(payload->>'guestId', '')), '');
  if gid is null or length(gid) < 8 then
    raise exception 'invalid guest draft';
  end if;

  insert into public.profiles (id, timezone)
  values (uid, coalesce(nullif(payload->>'timezone', ''), 'UTC'))
  on conflict (id) do nothing;

  select merged_guest_id into existing
  from public.profiles
  where id = uid;

  if existing = gid then
    return jsonb_build_object('ok', true, 'alreadyMerged', true);
  end if;

  for act in
    select value from jsonb_array_elements(coalesce(payload->'activities', '[]'::jsonb))
  loop
    exit when n >= 3;
    if btrim(regexp_replace(coalesce(act->>'name', ''), '\s+', ' ', 'g')) = '' then
      continue;
    end if;
    lid := coalesce(nullif(act->>'localId', ''), gen_random_uuid()::text);
    v_type := coalesce(nullif(act->>'type', ''), 'daily');
    v_deadline := nullif(act->>'deadline', '')::date;
    if v_type = 'deadline' and v_deadline is null then
      v_type := 'daily';
    end if;
    if v_type not in ('daily', 'weekly_n', 'deadline', 'monthly') then
      v_type := 'daily';
    end if;

    insert into public.activities (
      user_id, name, emoji, type, tracking_mode,
      target_value, target_unit, weekly_target, deadline,
      why_matters, usually_when
    )
    values (
      uid,
      left(btrim(regexp_replace(coalesce(act->>'name', ''), '\s+', ' ', 'g')), 40),
      coalesce(nullif(act->>'emoji', ''), '•'),
      v_type,
      case
        when coalesce(act->>'trackingMode', 'timer') in ('timer', 'count', 'checkbox')
          then coalesce(act->>'trackingMode', 'timer')
        else 'timer'
      end,
      nullif(act->>'targetValue', '')::numeric,
      nullif(act->>'targetUnit', ''),
      nullif(act->>'weeklyTarget', '')::int,
      case when v_type = 'deadline' then v_deadline else null end,
      left(nullif(btrim(coalesce(act->>'why', '')), ''), 80),
      left(nullif(btrim(coalesce(act->>'usuallyWhen', '')), ''), 40)
    )
    returning id into aid;

    id_map := id_map || jsonb_build_object(lid, aid);
    n := n + 1;
  end loop;

  for logrow in
    select value from jsonb_array_elements(coalesce(payload->'logs', '[]'::jsonb))
  loop
    aid := nullif(id_map->>coalesce(logrow->>'localActivityId', ''), '')::uuid;
    if aid is null then
      continue;
    end if;
    if coalesce((logrow->>'durationSeconds')::int, 0) < 30 then
      continue;
    end if;

    started := nullif(logrow->>'startedAt', '')::timestamptz;
    log_date := coalesce(
      nullif(logrow->>'date', '')::date,
      (started at time zone coalesce(payload->>'timezone', 'UTC'))::date
    );

    insert into public.log_entries (
      activity_id, user_id, type, source, started_at, duration_seconds, date
    )
    values (
      aid, uid, 'session', 'timer', started, (logrow->>'durationSeconds')::int, log_date
    );
  end loop;

  update public.profiles
  set
    timezone = coalesce(nullif(payload->>'timezone', ''), timezone),
    reminder_time = nullif(payload->>'reminderTime', ''),
    checkins_opt_out = (nullif(payload->>'reminderTime', '') is null),
    slip_answer = coalesce(payload->'slipAnswer', '[]'::jsonb),
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    merged_guest_id = gid,
    updated_at = now()
  where id = uid;

  return jsonb_build_object('ok', true, 'alreadyMerged', false, 'activities', n);
end;
$$;

revoke all on function public.merge_guest_draft(jsonb) from public;
grant execute on function public.merge_guest_draft(jsonb) to authenticated;

-- Who should hear from us right now. Service role only (emails live in auth.users).
create or replace function public.due_checkins(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  day_n integer,
  timezone text,
  checkin_token uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with local as (
    select
      p.id,
      u.email::text as email,
      coalesce(nullif(p.timezone, ''), 'UTC') as tz,
      p.checkin_token,
      (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC')) as local_now,
      (
        (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
        - (p.onboarding_completed_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      ) as day_span
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.onboarding_completed_at is not null
      and p.checkins_opt_out = false
      and u.email is not null
  )
  select l.id, l.email, l.day_span, l.tz, l.checkin_token
  from local l
  where l.day_span in (2, 3, 7)
    and (extract(hour from l.local_now) < 22 and extract(hour from l.local_now) >= 7)
    and (
      select count(*) from public.checkin_deliveries d
      where d.user_id = l.id and d.opened_at is null
    ) < 3
    and not exists (
      select 1 from public.checkin_deliveries d
      where d.user_id = l.id and d.day_n = l.day_span
    )
    and not exists (
      select 1 from public.checkin_deliveries d
      where d.user_id = l.id
        and (d.sent_at at time zone l.tz)::date = l.local_now::date
    );
$$;

revoke all on function public.due_checkins(timestamptz) from public;
revoke all on function public.due_checkins(timestamptz) from anon, authenticated;
grant execute on function public.due_checkins(timestamptz) to service_role;

create or replace function public.opt_out_checkins(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update public.profiles
  set checkins_opt_out = true, updated_at = now()
  where checkin_token = p_token;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.opt_out_checkins(uuid) from public;
grant execute on function public.opt_out_checkins(uuid) to anon, authenticated;

create or replace function public.mark_checkin_opened()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated int;
begin
  if auth.uid() is null then
    return 0;
  end if;
  update public.checkin_deliveries
  set opened_at = coalesce(opened_at, now())
  where user_id = auth.uid() and opened_at is null;
  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.mark_checkin_opened() from public;
grant execute on function public.mark_checkin_opened() to authenticated;

comment on function public.due_checkins(timestamptz) is
  'Call send-check-ins hourly with the service role. Quiet hours 22:00–07:00, one send a day, stop after 3 unopened.';
