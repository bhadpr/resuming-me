-- Seed 30 days of demo daily-goal vitals to review the vitals chart: Water, Protein, Fasting.
-- Target: bhadpr@gmail.com
-- Add-only. It never deletes or overwrites: a day that already has a reading is left alone.
-- Units follow the app defaults: Water in glasses (goal 8), Protein in g (goal 50), Fasting in hours (goal 16).
-- Set each target in the app to see days judged against it.

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

  -- Water (glasses): 4-10, goal 8
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'water' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Water', '💧', 'glasses', 'water')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (v_metric_id, v_user_id, d, 4 + ((i * 5) % 7))
    on conflict (metric_id, date) do nothing;
  end loop;

  -- Protein (g): 30-80, goal 50
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'protein' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Protein', '🍽️', 'g', 'protein')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (v_metric_id, v_user_id, d, 30 + ((i * 17) % 51))
    on conflict (metric_id, date) do nothing;
  end loop;

  -- Fasting (hours): 10-19, goal 16
  select id into v_metric_id from public.metrics
  where user_id = v_user_id and template_id = 'fasting' and not archived limit 1;
  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit, template_id)
    values (v_user_id, 'Fasting', '🌙', 'hours', 'fasting')
    returning id into v_metric_id;
  end if;
  for i in 0..29 loop
    d := v_today - (29 - i);
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (v_metric_id, v_user_id, d, 10 + ((i * 7) % 10))
    on conflict (metric_id, date) do nothing;
  end loop;
end $$;
