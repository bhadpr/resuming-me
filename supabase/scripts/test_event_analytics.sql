-- Checks the admin event analytics functions (migration 20261029120000_admin_event_analytics.sql).
-- Needs that migration applied first.
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_event_analytics.sql
-- It adds test events inside one transaction, compares the numbers before and after, and rolls
-- everything back, so nothing is kept. A failed check stops with its name. Real data stays in the
-- totals, so the checks use test-only event names and versions, or compare the change.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where is_admin limit 1),
  true
);

do $$
declare
  today constant timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  this_week constant date := date_trunc('week', now() at time zone 'utc')::date;
  this_month constant date := date_trunc('month', now() at time zone 'utc')::date;
  w jsonb; m jsonb; ev jsonb; idx integer;
  ins_b jsonb; ins_a jsonb;
  err_b jsonb; err_a jsonb;
  rec jsonb;
begin
  -- Per week and per month: two events this week, one three weeks ago, one a month back.
  insert into public.events (anon_id, name, props, created_at) values
    ('t-evt-aaaaaa', 'zz_test_event', '{}', now()),
    ('t-evt-bbbbbb', 'zz_test_event', '{}', now()),
    ('t-evt-aaaaaa', 'zz_test_event', '{}', now() - interval '21 days'),
    ('t-evt-aaaaaa', 'zz_test_event', '{}', (date_trunc('month', now() at time zone 'utc') - interval '1 month' + interval '10 days') at time zone 'utc');

  w := public.event_counts_by_period('week', 6);
  assert jsonb_array_length(w->'starts') = 6, 'week: six periods';
  assert (w->'starts'->>5)::date = this_week, 'week: the last period is this week';
  assert (w->>'currentStart')::date = this_week, 'week: current start';
  select e into ev from jsonb_array_elements(w->'events') e where e->>'name' = 'zz_test_event';
  assert ev is not null, 'week: test event is listed';
  assert (ev->'counts'->>5)::int = 2, 'week: two events this week';
  assert (ev->'devices'->>5)::int = 2, 'week: two devices this week';
  assert (ev->'counts'->>2)::int = 1, 'week: one event three weeks ago';
  assert (ev->>'total')::int >= 3, 'week: total (the month-old event may fall outside six weeks)';

  m := public.event_counts_by_period('month', 3);
  assert jsonb_array_length(m->'starts') = 3, 'month: three periods';
  assert (m->'starts'->>2)::date = this_month, 'month: the last period is this month';
  select e into ev from jsonb_array_elements(m->'events') e where e->>'name' = 'zz_test_event';
  assert (ev->'counts'->>1)::int >= 1, 'month: one event last month';
  assert (ev->>'total')::int = 4, 'month: total';

  assert jsonb_array_length(public.event_counts_by_period('year', 999)->'starts') = 26, 'period: unknown name falls back to weeks, capped at 26';
  assert jsonb_array_length(public.event_counts_by_period('month', 999)->'starts') = 13, 'month: capped at 13';

  -- First opens: two new Android devices on one test version, one of them seen before the window.
  ins_b := public.app_installs_summary(30);
  insert into public.events (anon_id, name, props, app_version, platform, created_at) values
    ('t-ins-aaaaaa', 'app_opened', '{"locale": "hi"}', 'zz-9.9.9', 'android', today - interval '2 days'),
    ('t-ins-aaaaaa', 'app_opened', '{"locale": "hi"}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-ins-bbbbbb', 'app_opened', '{"locale": "ta"}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-ins-cccccc', 'app_opened', '{"locale": "en"}', 'zz-9.9.9', 'android', today - interval '60 days'),
    ('t-ins-cccccc', 'app_opened', '{"locale": "en"}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-ins-dddddd', 'app_opened', '{"locale": "gu"}', 'zz-9.9.9', 'web', today - interval '1 day'),
    ('t-ins-eeeeee', 'app_opened', '{"locale": "xx"}', 'zz-9.9.9', 'android', today - interval '1 day');
  ins_a := public.app_installs_summary(30);
  assert (ins_a->>'firstOpens')::int - (ins_b->>'firstOpens')::int = 3, 'installs: three first opens (a, b and e; c was first seen 60 days ago)';
  select r into rec from jsonb_array_elements(ins_a->'firstOpensByVersion') r where r->>'key' = 'zz-9.9.9';
  assert (rec->>'count')::int = 3, 'installs: first opens by version';
  select r into rec from jsonb_array_elements(ins_a->'firstOpensByLanguage') r where r->>'key' = 'hi';
  assert (rec->>'count')::int - coalesce((select (r->>'count')::int from jsonb_array_elements(ins_b->'firstOpensByLanguage') r where r->>'key' = 'hi'), 0) = 1, 'installs: Hindi first open';
  select r into rec from jsonb_array_elements(ins_a->'firstOpensByLanguage') r where r->>'key' = 'unknown';
  assert (rec->>'count')::int - coalesce((select (r->>'count')::int from jsonb_array_elements(ins_b->'firstOpensByLanguage') r where r->>'key' = 'unknown'), 0) = 1, 'installs: a language the app does not have counts as unknown';
  assert (ins_a->>'activeDevices')::int - (ins_b->>'activeDevices')::int = 4, 'installs: four Android devices opened it in the window';
  assert (ins_a->>'webDevices')::int - (ins_b->>'webDevices')::int = 1, 'installs: one web device';
  select r into rec from jsonb_array_elements(ins_a->'webByLanguage') r where r->>'key' = 'gu';
  assert (rec->>'count')::int - coalesce((select (r->>'count')::int from jsonb_array_elements(ins_b->'webByLanguage') r where r->>'key' = 'gu'), 0) = 1, 'installs: web language';
  assert jsonb_array_length(ins_a->'firstOpensPerDay') = 30, 'installs: one entry per day, zero days included';
  assert (ins_a->>'languageKnownSince') is not null, 'installs: language known since';

  -- Errors.
  err_b := public.app_errors_summary(30);
  insert into public.events (anon_id, name, props, app_version, platform, created_at) values
    ('t-err-aaaaaa', 'app_error', '{"kind": "error", "message": "zz test failure", "file": "index.js", "line": 12}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-err-aaaaaa', 'app_error', '{"kind": "error", "message": "zz test failure", "file": "index.js", "line": 12}', 'zz-9.9.9', 'android', today),
    ('t-err-bbbbbb', 'app_error', '{"kind": "promise", "message": "zz other failure"}', 'zz-9.9.9', 'android', today),
    ('t-err-cccccc', 'app_error', '{}', 'zz-9.9.9', 'web', today - interval '40 days');
  err_a := public.app_errors_summary(30);
  assert (err_a->>'total')::int - (err_b->>'total')::int = 3, 'errors: three in the window';
  assert (err_a->>'devices')::int - (err_b->>'devices')::int = 2, 'errors: two devices';
  select r into rec from jsonb_array_elements(err_a->'top') r where r->>'message' = 'zz test failure';
  assert (rec->>'count')::int = 2 and (rec->>'devices')::int = 1, 'errors: the common message is counted';
  assert rec->>'file' = 'index.js', 'errors: file';
  select r into rec from jsonb_array_elements(err_a->'byVersion') r where r->>'version' = 'zz-9.9.9' and r->>'platform' = 'android';
  assert (rec->>'count')::int = 3, 'errors: by version';
  assert jsonb_array_length(err_a->'perDay') = 30, 'errors: one entry per day';

  raise notice 'event analytics checks passed';
end;
$$;

rollback;
