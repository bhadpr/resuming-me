-- Seed 30 days of demo vitals to review the vitals chart: Blood Pressure, Heart Rate, Weight, Daily Steps.
-- Target: bhadpr@gmail.com
-- Add-only. It never deletes or overwrites: a day that already has a reading is left alone.
-- Blood Pressure mixes within-target and off-target days (120/80 limits).
-- Heart Rate has a few readings outside 60-100. Steps hover around an 8,000 goal.
-- Weight (lbs) continues the older demo drift. Set a weight target in the app to see it judged.

do $$
declare
  v_user_id uuid;
  v_metric_id uuid;
  v_today date := (timezone('America/Los_Angeles', now()))::date;
  d date;
  i int;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('bhadpr@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users row for bhadpr@gmail.com';
  end if;

  -- Blood Pressure (upper in value, lower in secondary_value)
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'blood_pressure' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Blood Pressure', '🩺', 'mmHg', 'blood_pressure')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value, secondary_value)
    values (v_metric_id, v_user_id, d, 112 + ((i * 7) % 19), 72 + ((i * 5) % 15))
    on conflict (metric_id, date) do nothing;
  end loop;

  -- Heart Rate
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'heart_rate' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Heart Rate', '❤️', 'bpm', 'heart_rate')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (
      v_metric_id, v_user_id, d,
      case when i % 11 = 4 then 103 when i % 13 = 6 then 57 else 64 + ((i * 11) % 22) end
    )
    on conflict (metric_id, date) do nothing;
  end loop;

  -- Weight (lbs), continuing the older drift down
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'weight' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Weight', '⚖️', 'lbs', 'weight')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (
      v_metric_id, v_user_id, d,
      round((176.0 - i * 0.18 + case when i % 5 = 0 then 0.5 when i % 7 = 0 then -0.4 else 0 end)::numeric, 1)
    )
    on conflict (metric_id, date) do nothing;
  end loop;

  -- Daily Steps
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'steps' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Daily Steps', '👟', 'steps', 'steps')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (v_metric_id, v_user_id, d, 4500 + ((i * 1337) % 7000))
    on conflict (metric_id, date) do nothing;
  end loop;
end $$;
