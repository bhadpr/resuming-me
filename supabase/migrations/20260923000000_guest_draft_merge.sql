-- P2-01: persist guest onboarding in one transaction after sign-in.

alter table public.profiles
  add column if not exists reminder_time text,
  add column if not exists slip_answer jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists merged_guest_id text;

create unique index if not exists profiles_merged_guest_id_key
  on public.profiles (merged_guest_id)
  where merged_guest_id is not null;

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
      user_id,
      name,
      emoji,
      type,
      tracking_mode,
      target_value,
      target_unit,
      weekly_target,
      deadline
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
      case when v_type = 'deadline' then v_deadline else null end
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
    log_date := coalesce(nullif(logrow->>'date', '')::date, (started at time zone coalesce(payload->>'timezone', 'UTC'))::date);

    insert into public.log_entries (
      activity_id,
      user_id,
      type,
      source,
      started_at,
      duration_seconds,
      date
    )
    values (
      aid,
      uid,
      'session',
      'timer',
      started,
      (logrow->>'durationSeconds')::int,
      log_date
    );
  end loop;

  update public.profiles
  set
    timezone = coalesce(nullif(payload->>'timezone', ''), timezone),
    reminder_time = nullif(payload->>'reminderTime', ''),
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
