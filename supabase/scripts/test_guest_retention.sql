-- Checks guest_retention_summary (migration 20261031120000_guest_retention.sql).
-- Needs that migration applied first (or concatenated in front of this file).
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_guest_retention.sql
-- It adds test devices inside one transaction, compares the numbers before and after, and rolls
-- everything back, so nothing is kept.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where is_admin limit 1),
  true
);

do $$
declare
  today constant timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  first_day constant timestamptz := today - interval '20 days';
  the_week constant date := date_trunc('week', (now() at time zone 'utc') - interval '20 days')::date;
  v_user uuid := (select id from auth.users limit 1);
  b jsonb; a jsonb;
  bw jsonb; aw jsonb;
begin
  b := public.guest_retention_summary(6, 'android');

  insert into public.events (anon_id, user_id, name, props, app_version, platform, created_at) values
    -- guest A: first day, next day, and a week later
    ('t-ret-aaaaaa', null, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day),
    ('t-ret-aaaaaa', null, 'log_created', '{}', 'zz-9.9.9', 'android', first_day + interval '1 day'),
    ('t-ret-aaaaaa', null, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day + interval '7 days'),
    -- guest B: first day only
    ('t-ret-bbbbbb', null, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day),
    -- guest C: back on day 3 only (a week, but not D1 and not D7)
    ('t-ret-cccccc', null, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day),
    ('t-ret-cccccc', null, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day + interval '3 days'),
    -- account D: signed in, first day and next day
    ('t-ret-dddddd', v_user, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day),
    ('t-ret-dddddd', v_user, 'app_opened', '{}', 'zz-9.9.9', 'android', first_day + interval '1 day'),
    -- a web device: left out of the Android numbers
    ('t-ret-eeeeee', null, 'app_opened', '{}', 'zz-9.9.9', 'web', first_day),
    -- first seen 60 days ago, active yesterday: outside a six-week window
    ('t-ret-ffffff', null, 'app_opened', '{}', 'zz-9.9.9', 'android', today - interval '60 days'),
    ('t-ret-ffffff', null, 'app_opened', '{}', 'zz-9.9.9', 'android', today - interval '1 day'),
    -- first seen today: nothing is measurable yet
    ('t-ret-gggggg', null, 'app_opened', '{}', 'zz-9.9.9', 'android', today + interval '1 hour');

  a := public.guest_retention_summary(6, 'android');

  -- Headline: guests A, B, C and G (new today); account D.
  assert (a#>>'{headline,guest,size}')::int - (b#>>'{headline,guest,size}')::int = 4, 'headline: four new guest devices';
  assert (a#>>'{headline,account,size}')::int - (b#>>'{headline,account,size}')::int = 1, 'headline: one new account device';
  assert (a#>>'{headline,guest,e1}')::int - (b#>>'{headline,guest,e1}')::int = 3, 'headline: D1 is measured on the three guests older than a day';
  assert (a#>>'{headline,guest,r1}')::int - (b#>>'{headline,guest,r1}')::int = 1, 'headline: one guest was back the next day (A)';
  assert (a#>>'{headline,guest,rw1}')::int - (b#>>'{headline,guest,rw1}')::int = 2, 'headline: two guests were back within a week (A and C)';
  assert (a#>>'{headline,guest,r7}')::int - (b#>>'{headline,guest,r7}')::int = 1, 'headline: one guest was back on day 7 (A)';
  assert (a#>>'{headline,guest,e30}')::int - (b#>>'{headline,guest,e30}')::int = 0, 'headline: day 30 is not over for any of them';
  assert (a#>>'{headline,account,r1}')::int - (b#>>'{headline,account,r1}')::int = 1, 'headline: the account device was back the next day';

  -- The web device is only in the web and all views.
  assert (public.guest_retention_summary(6, 'web')#>>'{headline,guest,size}')::int >= 1, 'platform: web sees the web device';
  assert (public.guest_retention_summary(6, 'all')#>>'{headline,guest,size}')::int >= (a#>>'{headline,guest,size}')::int + 1, 'platform: all includes the web device';
  assert a->>'platform' = 'android' and public.guest_retention_summary(6, 'nonsense')->>'platform' = 'all', 'platform: unknown falls back to all';

  -- Weekly cohort of the first day: A, B, C (guests) and D (account).
  select w into bw from jsonb_array_elements(b->'weeks') w where (w->>'weekStart')::date = the_week;
  select w into aw from jsonb_array_elements(a->'weeks') w where (w->>'weekStart')::date = the_week;
  assert aw is not null, 'weeks: the cohort week is listed';
  assert (aw#>>'{guest,size}')::int - coalesce((bw#>>'{guest,size}')::int, 0) = 3, 'weeks: three guests started that week';
  assert (aw#>>'{account,size}')::int - coalesce((bw#>>'{account,size}')::int, 0) = 1, 'weeks: one account device started that week';
  assert jsonb_array_length(a->'weeks') = 6, 'weeks: six weeks listed';
  assert not exists (
    select 1 from jsonb_array_elements(a->'weeks') w
    where (w->>'weekStart')::date < date_trunc('week', now() at time zone 'utc')::date - 35
  ), 'weeks: nothing older than the window';

  raise notice 'guest retention checks passed';
end;
$$;

-- Not an admin: refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

do $$
begin
  begin
    perform public.guest_retention_summary(12, 'android');
    assert false, 'retention: refused for a non-admin';
  exception when raise_exception then
    assert sqlerrm = 'not authorized', 'retention: non-admin message, got ' || sqlerrm;
  end;
end;
$$;

rollback;
