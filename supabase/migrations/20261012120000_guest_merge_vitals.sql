-- Guest merge: weight, blood pressure, and heart rate become vitals (metrics) with their
-- readings, instead of tick-off habits. Keep every guest habit, not only the first three.

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
  readrow jsonb;
  n int := 0;
  m int := 0;
  aid uuid;
  mid uuid;
  lid text;
  id_map jsonb := '{}'::jsonb;
  metric_map jsonb := '{}'::jsonb;
  started timestamptz;
  log_date date;
  v_type text;
  v_deadline date;
  v_template text;
  v_name text;
  v_value numeric;
  v_secondary numeric;
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
    v_name := left(btrim(regexp_replace(coalesce(act->>'name', ''), '\s+', ' ', 'g')), 40);
    if v_name = '' then
      continue;
    end if;
    lid := coalesce(nullif(act->>'localId', ''), gen_random_uuid()::text);

    v_template := nullif(left(coalesce(act->>'templateId', ''), 40), '');
    if v_template is not null and v_template !~ '^[a-z0-9_]+$' then
      v_template := null;
    end if;

    -- Typed vitals live in metrics. Reuse one the account already has.
    if v_template in ('weight', 'blood_pressure', 'heart_rate') then
      continue when m >= 10;
      select id into mid
      from public.metrics
      where user_id = uid
        and archived = false
        and (
          template_id = v_template
          or lower(btrim(name)) = case v_template
            when 'weight' then 'weight'
            when 'blood_pressure' then 'blood pressure'
            else 'heart rate'
          end
        )
      order by created_at
      limit 1;

      if mid is null then
        insert into public.metrics (user_id, name, emoji, unit, template_id, name_overridden)
        values (
          uid,
          v_name,
          coalesce(nullif(act->>'emoji', ''), '📊'),
          case v_template
            when 'weight' then 'kg'
            when 'blood_pressure' then 'mmHg'
            else 'bpm'
          end,
          v_template,
          false
        )
        returning id into mid;
      end if;

      metric_map := metric_map || jsonb_build_object(lid, mid);
      m := m + 1;
      continue;
    end if;

    exit when n >= 20;
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
      why_matters, usually_when, template_id, name_overridden
    )
    values (
      uid,
      v_name,
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
      left(nullif(btrim(coalesce(act->>'usuallyWhen', '')), ''), 40),
      v_template,
      coalesce(act->>'nameOverridden' in ('true', 't'), false)
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

    started := nullif(logrow->>'startedAt', '')::timestamptz;
    log_date := coalesce(
      nullif(logrow->>'date', '')::date,
      (started at time zone coalesce(payload->>'timezone', 'UTC'))::date
    );
    if log_date is null then
      continue;
    end if;

    if coalesce(logrow->>'kind', 'session') = 'count' then
      insert into public.log_entries (
        activity_id, user_id, type, source, started_at, duration_seconds, date
      )
      values (
        aid, uid, 'completed', 'manual', started, null, log_date
      );
      continue;
    end if;

    if coalesce((logrow->>'durationSeconds')::int, 0) < 30 then
      continue;
    end if;

    insert into public.log_entries (
      activity_id, user_id, type, source, started_at, duration_seconds, date
    )
    values (
      aid, uid, 'session', 'timer', started, (logrow->>'durationSeconds')::int, log_date
    );
  end loop;

  -- A reading already saved in the account for that day wins.
  for readrow in
    select value from jsonb_array_elements(coalesce(payload->'readings', '[]'::jsonb))
  loop
    mid := nullif(metric_map->>coalesce(readrow->>'localActivityId', ''), '')::uuid;
    if mid is null then
      continue;
    end if;
    log_date := nullif(readrow->>'date', '')::date;
    v_value := nullif(readrow->>'value', '')::numeric;
    v_secondary := nullif(readrow->>'secondaryValue', '')::numeric;
    if log_date is null or v_value is null or v_value <= 0 then
      continue;
    end if;

    insert into public.metric_entries (metric_id, user_id, date, value, secondary_value)
    values (mid, uid, log_date, v_value, v_secondary)
    on conflict (metric_id, date) do nothing;
  end loop;

  update public.profiles
  set
    timezone = coalesce(nullif(payload->>'timezone', ''), timezone),
    reminder_time = nullif(payload->>'reminderTime', ''),
    checkins_opt_out = (nullif(payload->>'reminderTime', '') is null),
    slip_answer = coalesce(payload->'slipAnswer', '[]'::jsonb),
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    merged_guest_id = gid,
    locale = coalesce(
      locale,
      case when payload->>'locale' in ('en', 'hi', 'te', 'gu', 'mr', 'ta') then payload->>'locale' else null end
    ),
    updated_at = now()
  where id = uid;

  return jsonb_build_object('ok', true, 'alreadyMerged', false, 'activities', n, 'vitals', m);
end;
$$;
