-- A vital's description and target belong to the account, and a second copy of the same vital is archived.

alter table public.metrics
  add column if not exists description text,
  add column if not exists target_value numeric;

alter table public.metrics drop constraint if exists metrics_description_len;
alter table public.metrics
  add constraint metrics_description_len
    check (description is null or char_length(btrim(description)) between 1 and 80);

alter table public.metrics drop constraint if exists metrics_target_value_pos;
alter table public.metrics
  add constraint metrics_target_value_pos
    check (target_value is null or target_value > 0);

-- Keep the oldest live vital for each catalog id. Move readings onto it, then archive the copies.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by user_id, template_id
      order by created_at, id
    ) as keeper,
    row_number() over (
      partition by user_id, template_id
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is not null
),
dupes as (
  select id, keeper from ranked where n > 1
)
update public.metric_entries as entry
set metric_id = dupes.keeper
from dupes
where entry.metric_id = dupes.id
  and not exists (
    select 1
    from public.metric_entries kept
    where kept.metric_id = dupes.keeper
      and kept.date = entry.date
  );

with ranked as (
  select id,
    row_number() over (
      partition by user_id, template_id
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is not null
)
delete from public.metric_entries
where metric_id in (select id from ranked where n > 1);

with ranked as (
  select id,
    row_number() over (
      partition by user_id, template_id
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is not null
)
update public.metrics
set archived = true
where id in (select id from ranked where n > 1);

-- Same name, no catalog id.
with ranked as (
  select
    id,
    first_value(id) over (
      partition by user_id, lower(btrim(name))
      order by created_at, id
    ) as keeper,
    row_number() over (
      partition by user_id, lower(btrim(name))
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is null
),
dupes as (
  select id, keeper from ranked where n > 1
)
update public.metric_entries as entry
set metric_id = dupes.keeper
from dupes
where entry.metric_id = dupes.id
  and not exists (
    select 1
    from public.metric_entries kept
    where kept.metric_id = dupes.keeper
      and kept.date = entry.date
  );

with ranked as (
  select id,
    row_number() over (
      partition by user_id, lower(btrim(name))
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is null
)
delete from public.metric_entries
where metric_id in (select id from ranked where n > 1);

with ranked as (
  select id,
    row_number() over (
      partition by user_id, lower(btrim(name))
      order by created_at, id
    ) as n
  from public.metrics
  where archived = false
    and template_id is null
)
update public.metrics
set archived = true
where id in (select id from ranked where n > 1);

create unique index if not exists metrics_user_template_idx
  on public.metrics (user_id, template_id)
  where archived = false and template_id is not null;

create unique index if not exists metrics_user_name_idx
  on public.metrics (user_id, lower(btrim(name)))
  where archived = false and template_id is null;

-- Guest sign-in copies the vital's description and target onto the account.
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
  v_note text;
  v_target numeric;
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
  where id = uid
  for update;

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

    v_note := left(nullif(btrim(coalesce(act->>'why', '')), ''), 80);
    v_target := nullif(act->>'targetValue', '')::numeric;
    if v_target is not null and v_target <= 0 then
      v_target := null;
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
        insert into public.metrics (
          user_id, name, emoji, unit, template_id, name_overridden, description, target_value
        )
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
          false,
          v_note,
          v_target
        )
        returning id into mid;
      else
        update public.metrics
        set
          description = coalesce(description, v_note),
          target_value = coalesce(target_value, v_target),
          updated_at = now()
        where id = mid;
      end if;

      metric_map := metric_map || jsonb_build_object(lid, mid);
      m := m + 1;
      continue;
    end if;

    -- Keep a habit the account already has, matched by catalog id.
    aid := null;
    if v_template is not null then
      select a.id into aid
      from public.activities a
      where a.user_id = uid
        and a.archived = false
        and a.template_id = v_template
      order by a.created_at
      limit 1;
    end if;

    if aid is not null then
      update public.activities
      set why_matters = coalesce(why_matters, v_note)
      where id = aid
        and why_matters is null
        and v_note is not null;
      id_map := id_map || jsonb_build_object(lid, aid);
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
      v_note,
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
      case when payload->>'locale' in ('en', 'hi', 'te', 'gu', 'mr', 'ta', 'bn') then payload->>'locale' else null end
    ),
    updated_at = now()
  where id = uid;

  return jsonb_build_object('ok', true, 'alreadyMerged', false, 'activities', n, 'vitals', m);
end;
$$;
