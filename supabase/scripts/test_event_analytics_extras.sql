-- Checks the functions in migration 20261030120000_event_analytics_extras.sql.
-- Needs migrations 20261029120000 and 20261030120000 applied (or concatenated in front of this file).
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_event_analytics_extras.sql
-- It adds test events inside one transaction, compares the numbers before and after, and rolls
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
  ins_b jsonb; ins_a jsonb;
  al_b jsonb; al_a jsonb;
  bd jsonb;
  rec jsonb;
begin
  -- Install source: three new devices on a test version, two of them tagged.
  ins_b := public.app_installs_summary(30);
  insert into public.events (anon_id, name, props, app_version, platform, created_at) values
    ('t-src-aaaaaa', 'app_opened', '{}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-src-bbbbbb', 'app_opened', '{}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-src-cccccc', 'app_opened', '{}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-src-aaaaaa', 'install_attributed', '{"source": "zz-site", "medium": "web", "content": "landing"}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-src-bbbbbb', 'install_attributed', '{"source": "zz-site", "medium": "web", "content": "landing"}', 'zz-9.9.9', 'android', today - interval '1 day');
  ins_a := public.app_installs_summary(30);
  assert (ins_a->>'firstOpens')::int - (ins_b->>'firstOpens')::int = 3, 'source: three first opens';
  select r into rec from jsonb_array_elements(ins_a->'firstOpensBySource') r where r->>'key' = 'zz-site · landing';
  assert (rec->>'count')::int = 2, 'source: two came from the landing button';
  select r into rec from jsonb_array_elements(ins_a->'firstOpensBySource') r where r->>'key' = 'unknown';
  assert (rec->>'count')::int - coalesce((select (r->>'count')::int from jsonb_array_elements(ins_b->'firstOpensBySource') r where r->>'key' = 'unknown'), 0) = 1, 'source: an untagged install is unknown';
  assert (ins_a->>'sourceKnownSince') is not null, 'source: known since';
  assert ins_a ? 'firstOpensByVersion' and ins_a ? 'webByLanguage', 'source: the older fields are still there';

  -- Alerts: the latest event of each device counts. a changed its mind, b has alarms off, c is ready.
  al_b := public.alert_status_summary(30);
  insert into public.events (anon_id, name, props, app_version, platform, created_at) values
    ('t-alr-aaaaaa', 'alerts_status', '{"notifications": "denied", "exact_alarms": "granted", "planned": 2}', 'zz-9.9.9', 'android', today - interval '2 days'),
    ('t-alr-aaaaaa', 'alerts_status', '{"notifications": "granted", "exact_alarms": "granted", "planned": 2}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-alr-bbbbbb', 'alerts_status', '{"notifications": "granted", "exact_alarms": "denied", "planned": 1}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-alr-cccccc', 'alerts_status', '{"notifications": "denied", "exact_alarms": "unknown", "planned": 3}', 'zz-9.9.9', 'android', today - interval '1 day'),
    ('t-alr-dddddd', 'alerts_status', '{"notifications": "denied", "exact_alarms": "unknown", "planned": 3}', 'zz-9.9.9', 'web', today - interval '1 day');
  al_a := public.alert_status_summary(30);
  assert (al_a->>'devices')::int - (al_b->>'devices')::int = 3, 'alerts: three Android devices (web is ignored)';
  assert (al_a->>'ready')::int - (al_b->>'ready')::int = 1, 'alerts: one device is ready (a, by its latest event)';
  assert (al_a->>'notificationsOff')::int - (al_b->>'notificationsOff')::int = 1, 'alerts: one has notifications off (c)';
  assert (al_a->>'exactAlarmsOff')::int - (al_b->>'exactAlarmsOff')::int = 1, 'alerts: one has exact alarms off (b)';
  assert jsonb_typeof(al_a->'states') = 'array', 'alerts: states list';

  -- Breakdown by property.
  insert into public.events (anon_id, name, props, created_at) values
    ('t-brk-aaaaaa', 'zz_break_event', '{"kind": "school"}', now()),
    ('t-brk-bbbbbb', 'zz_break_event', '{"kind": "school"}', now()),
    ('t-brk-aaaaaa', 'zz_break_event', '{"kind": "birthday", "has_time": true}', now()),
    ('t-brk-aaaaaa', 'zz_break_event', '{}', now()),
    ('t-brk-aaaaaa', 'zz_break_event', '{"kind": "old"}', now() - interval '60 days');
  bd := public.event_prop_breakdown('zz_break_event', 'kind', 30);
  assert bd->>'prop' = 'kind' and bd->>'name' = 'zz_break_event', 'breakdown: echoes the question';
  select r into rec from jsonb_array_elements(bd->'rows') r where r->>'key' = 'school';
  assert (rec->>'count')::int = 2 and (rec->>'devices')::int = 2, 'breakdown: school counted';
  select r into rec from jsonb_array_elements(bd->'rows') r where r->>'key' = '(not set)';
  assert (rec->>'count')::int = 1, 'breakdown: a missing property is "(not set)"';
  assert not exists (select 1 from jsonb_array_elements(bd->'rows') r where r->>'key' = 'old'), 'breakdown: outside the window is left out';
  bd := public.event_prop_breakdown('zz_break_event', 'has_time', 30);
  select r into rec from jsonb_array_elements(bd->'rows') r where r->>'key' = 'true';
  assert (rec->>'count')::int = 1, 'breakdown: booleans read as text';

  begin
    perform public.event_prop_breakdown('zz_break_event', 'kind; drop table events', 30);
    assert false, 'breakdown: a bad property name must be refused';
  exception when raise_exception then
    assert sqlerrm = 'invalid property', 'breakdown: refused with the right message, got ' || sqlerrm;
  end;

  raise notice 'event analytics extras checks passed';
end;
$$;

-- Not an admin: all three refuse.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

do $$
begin
  begin
    perform public.alert_status_summary(7);
    assert false, 'alerts: refused for a non-admin';
  exception when raise_exception then
    assert sqlerrm = 'not authorized', 'alerts: non-admin message, got ' || sqlerrm;
  end;
  begin
    perform public.event_prop_breakdown('x', 'kind', 7);
    assert false, 'breakdown: refused for a non-admin';
  exception when raise_exception then
    assert sqlerrm = 'not authorized', 'breakdown: non-admin message, got ' || sqlerrm;
  end;
  begin
    perform public.app_installs_summary(7);
    assert false, 'source: refused for a non-admin';
  exception when raise_exception then
    assert sqlerrm = 'not authorized', 'source: non-admin message, got ' || sqlerrm;
  end;
end;
$$;

rollback;
