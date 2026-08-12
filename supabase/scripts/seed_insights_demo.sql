-- Seed ~30 days of demo activity + log data for Insights.
-- Target: bhadpr@gmail.com
--
-- WARNING: deletes ALL existing activities + log_entries for this user,
-- then inserts a fresh demo set. Metrics are left alone.

do $$
declare
  v_user_id uuid;
  v_today date := (timezone('America/Los_Angeles', now()))::date;
  v_created timestamptz;
  v_reading uuid := gen_random_uuid();
  v_gym uuid := gen_random_uuid();
  v_walk uuid := gen_random_uuid();
  v_taxes uuid := gen_random_uuid();
  v_meditate uuid := gen_random_uuid();
  v_gym_weekly uuid := gen_random_uuid();
  d date;
  dow int;
  week_end date;
  week_start date;
  weekly_hits int;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('bhadpr@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users row for bhadpr@gmail.com — sign in once first';
  end if;

  -- Backdate creation so the full month window is "scheduled"
  v_created := ((v_today - 40)::text || ' 09:00:00')::timestamp
    at time zone 'America/Los_Angeles';

  delete from public.log_entries where user_id = v_user_id;
  delete from public.activity_target_history where user_id = v_user_id;
  delete from public.activities where user_id = v_user_id;

  insert into public.profiles (id, timezone)
  values (v_user_id, 'America/Los_Angeles')
  on conflict (id) do update set timezone = excluded.timezone;

  insert into public.activities (
    id, user_id, name, emoji, type, tracking_mode,
    target_value, target_unit, target_effective_from, weekly_target,
    archived, created_at, updated_at
  ) values
    (v_reading, v_user_id, 'Reading', '📖', 'daily', 'timer',
     10, 'minutes', v_today - 40, null, false, v_created, v_created),
    (v_gym, v_user_id, 'Gym', '🏋️', 'daily', 'checkbox',
     null, null, v_today - 40, null, false, v_created, v_created),
    (v_walk, v_user_id, 'Walk', '🚶', 'daily', 'timer',
     20, 'minutes', v_today - 40, null, false, v_created, v_created),
    (v_taxes, v_user_id, 'Taxes', '🧾', 'daily', 'checkbox',
     null, null, v_today - 40, null, false, v_created, v_created),
    (v_meditate, v_user_id, 'Meditate', '🧘', 'daily', 'timer',
     5, 'minutes', v_today - 40, null, false, v_created, v_created),
    (v_gym_weekly, v_user_id, 'Strength (3x/wk)', '💪', 'weekly_n', 'count',
     null, null, v_today - 40, 3, false, v_created, v_created);

  insert into public.activity_target_history (
    activity_id, user_id, target_value, target_unit, weekly_target, effective_from
  ) values
    (v_reading, v_user_id, 10, 'minutes', null, v_today - 40),
    (v_walk, v_user_id, 20, 'minutes', null, v_today - 40),
    (v_meditate, v_user_id, 5, 'minutes', null, v_today - 40),
    (v_gym_weekly, v_user_id, null, null, 3, v_today - 40);

  -- Local wall-clock → timestamptz helper via AT TIME ZONE
  -- Daily pattern over last 30 days (inclusive of today)
  for i in 0..29 loop
    d := v_today - (29 - i);
    dow := extract(dow from d)::int; -- 0=Sun .. 6=Sat

    -- Gym: often postponed Mon/Tue/Thu (weekday skip peak)
    if dow in (1, 2, 4) then
      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_gym, v_user_id, 'postponed', d,
        (d::text || ' 21:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    elsif dow in (3, 5) or (dow = 0 and i % 2 = 0) or (dow = 6 and i % 2 = 1) then
      insert into public.log_entries (
        activity_id, user_id, type, date, started_at, created_at
      ) values (
        v_gym, v_user_id, 'completed', d,
        (d::text || ' 18:15:00')::timestamp at time zone 'America/Los_Angeles',
        (d::text || ' 18:20:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;

    -- Taxes: heavily postponed (most-postponed)
    if dow in (1, 2, 3, 5) or (dow = 4 and i % 3 <> 0) then
      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_taxes, v_user_id, 'postponed', d,
        (d::text || ' 20:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    else
      insert into public.log_entries (
        activity_id, user_id, type, date, started_at, created_at
      ) values (
        v_taxes, v_user_id, 'completed', d,
        (d::text || ' 10:30:00')::timestamp at time zone 'America/Los_Angeles',
        (d::text || ' 10:45:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;

    -- Reading: mostly evening sessions; occasional Mon postpone
    if dow = 1 and i % 2 = 0 then
      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_reading, v_user_id, 'postponed', d,
        (d::text || ' 23:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    else
      insert into public.log_entries (
        activity_id, user_id, type, source, started_at, duration_seconds, date, created_at
      ) values (
        v_reading, v_user_id, 'session', 'timer',
        (d::text || ' 19:40:00')::timestamp at time zone 'America/Los_Angeles',
        600 + (i % 4) * 60,
        d,
        (d::text || ' 19:50:00')::timestamp at time zone 'America/Los_Angeles'
      );
      if i % 5 = 0 then
        insert into public.log_entries (
          activity_id, user_id, type, source, started_at, duration_seconds, date, created_at
        ) values (
          v_reading, v_user_id, 'session', 'manual',
          null,
          180,
          d,
          (d::text || ' 21:00:00')::timestamp at time zone 'America/Los_Angeles'
        );
      end if;
    end if;

    -- Walk: morning habit, rare weekend postpone
    if dow in (0, 6) and i % 3 = 0 then
      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_walk, v_user_id, 'postponed', d,
        (d::text || ' 16:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    else
      insert into public.log_entries (
        activity_id, user_id, type, source, started_at, duration_seconds, date, created_at
      ) values (
        v_walk, v_user_id, 'session', 'timer',
        (d::text || ' 07:10:00')::timestamp at time zone 'America/Los_Angeles',
        1200 + (i % 3) * 60,
        d,
        (d::text || ' 07:35:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;

    -- Meditate: afternoon; light mid-week postpone
    if dow = 3 and i % 2 = 1 then
      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_meditate, v_user_id, 'postponed', d,
        (d::text || ' 23:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    else
      insert into public.log_entries (
        activity_id, user_id, type, source, started_at, duration_seconds, date, created_at
      ) values (
        v_meditate, v_user_id, 'session', 'timer',
        (d::text || ' 13:05:00')::timestamp at time zone 'America/Los_Angeles',
        300 + (i % 2) * 60,
        d,
        (d::text || ' 13:12:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;

    -- Weekly strength counts on Mon/Wed/Fri
    if dow in (1, 3, 5) then
      insert into public.log_entries (
        activity_id, user_id, type, date, started_at, created_at
      ) values (
        v_gym_weekly, v_user_id, 'completed', d,
        (d::text || ' 17:30:00')::timestamp at time zone 'America/Los_Angeles',
        (d::text || ' 17:40:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;
  end loop;

  -- Skip one Friday completion in the oldest full week so that week is postponed
  delete from public.log_entries
  where activity_id = v_gym_weekly
    and type = 'completed'
    and date = (
      select max(d2)
      from generate_series(v_today - 29, v_today, interval '1 day') as g(d2)
      where extract(dow from g.d2::date) = 5
        and g.d2::date <= v_today - 14
    );

  -- Unmet weeks → postponed on Sunday (rollover day)
  for i in 0..4 loop
    -- Sunday ending each week looking back
    week_end := v_today - ((extract(dow from v_today)::int + i * 7));
    week_start := week_end - 6;
    if week_end < v_today - 29 then
      continue;
    end if;

    select count(*) into weekly_hits
    from public.log_entries
    where activity_id = v_gym_weekly
      and type = 'completed'
      and date between week_start and week_end;

    if weekly_hits < 3 then
      delete from public.log_entries
      where activity_id = v_gym_weekly
        and type = 'postponed'
        and date = week_end;

      insert into public.log_entries (activity_id, user_id, type, date, created_at)
      values (
        v_gym_weekly, v_user_id, 'postponed', week_end,
        (week_end::text || ' 23:00:00')::timestamp at time zone 'America/Los_Angeles'
      );
    end if;
  end loop;

  raise notice 'Seeded Insights demo for bhadpr@gmail.com (%) through %',
    v_user_id, v_today;
end $$;

select
  a.name,
  a.type,
  count(*) filter (where l.type = 'postponed') as postponed,
  count(*) filter (where l.type = 'completed') as completed,
  count(*) filter (where l.type = 'session') as sessions
from public.activities a
left join public.log_entries l on l.activity_id = a.id
where a.user_id = (
  select id from auth.users where lower(email) = lower('bhadpr@gmail.com') limit 1
)
group by a.name, a.type
order by postponed desc, a.name;
