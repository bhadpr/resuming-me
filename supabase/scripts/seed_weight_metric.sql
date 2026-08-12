-- Alias for seed_metrics_demo.sql (Weight + Sleep + Mood).
-- Target: bhadpr@gmail.com

do $$
declare
  v_user_id uuid;
  v_metric_id uuid;
  v_today date := (timezone('America/Los_Angeles', now()))::date;
  d date;
  i int;
  wobble numeric;
  sleep_base numeric := 7.2;
  mood_base numeric := 3.5;
  weight_base numeric := 178.4;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('bhadpr@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users row for bhadpr@gmail.com';
  end if;

  select id into v_metric_id
  from public.metrics
  where user_id = v_user_id and lower(name) = 'weight' and not archived
  limit 1;

  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit)
    values (v_user_id, 'Weight', '⚖️', 'lbs')
    returning id into v_metric_id;
  end if;

  delete from public.metric_entries where metric_id = v_metric_id;

  for i in 0..29 loop
    d := v_today - (29 - i);
    wobble := ((extract(dow from d)::int - 3) * 0.15)
      + case when i % 5 = 0 then 0.4 when i % 7 = 0 then -0.35 else 0 end;
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (
      v_metric_id,
      v_user_id,
      d,
      round((weight_base - (i * 0.08) + wobble)::numeric, 1)
    );
  end loop;

  select id into v_metric_id
  from public.metrics
  where user_id = v_user_id and lower(name) = 'sleep' and not archived
  limit 1;

  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit)
    values (v_user_id, 'Sleep', '😴', 'hrs')
    returning id into v_metric_id;
  end if;

  delete from public.metric_entries where metric_id = v_metric_id;

  for i in 0..29 loop
    d := v_today - (29 - i);
    wobble := case
      when extract(dow from d) in (0, 6) then 0.6
      when i % 9 = 0 then -1.2
      when i % 4 = 0 then -0.4
      else 0
    end;
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (
      v_metric_id,
      v_user_id,
      d,
      round(greatest(5.0, least(9.0, sleep_base + wobble + (random() * 0.6 - 0.3)))::numeric, 1)
    );
  end loop;

  select id into v_metric_id
  from public.metrics
  where user_id = v_user_id and lower(name) = 'mood' and not archived
  limit 1;

  if v_metric_id is null then
    insert into public.metrics (user_id, name, emoji, unit)
    values (v_user_id, 'Mood', '🙂', '1-5')
    returning id into v_metric_id;
  end if;

  delete from public.metric_entries where metric_id = v_metric_id;

  for i in 0..29 loop
    d := v_today - (29 - i);
    wobble := case
      when i % 9 = 0 then -1.2
      when extract(dow from d) = 1 then -0.3
      when extract(dow from d) in (5, 6) then 0.4
      else 0
    end;
    insert into public.metric_entries (metric_id, user_id, date, value)
    values (
      v_metric_id,
      v_user_id,
      d,
      round(greatest(1.0, least(5.0, mood_base + wobble + (random() * 0.8 - 0.4)))::numeric, 1)
    );
  end loop;
end $$;
