-- Checks the pay checks for referral groups (migration 20261021120000_marketing_pay_checks.sql).
-- Needs that migration applied first.
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_marketing_pay_checks.sql
-- It adds a test group and installs inside one transaction, checks the results, and rolls
-- everything back, so nothing is kept. A failed check stops with its name.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where is_admin limit 1),
  true
);

do $$
declare
  today constant date := (now() at time zone 'utc')::date;
  g uuid;
  m1 uuid;
  m2 uuid;
  settled_row record;
  n integer;
begin
  insert into public.marketing_groups (name) values ('test pay checks') returning id into g;
  insert into public.marketing_members (group_id, email) values (g, 'one@example.invalid') returning id into m1;
  insert into public.marketing_members (group_id, email) values (g, 'two@example.invalid') returning id into m2;

  -- Member one: 30 installs on a single day 60 days ago, every one opened on five days.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m1, encode(sha256(convert_to('spike-' || i, 'UTF8')), 'hex'), today - 60,
         array[today - 60, today - 59, today - 58, today - 57, today - 56]
  from generate_series(1, 30) as i;

  -- Ten ordinary installs, one a day, five of them opened on five days.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m1, encode(sha256(convert_to('single-' || i, 'UTF8')), 'hex'), today - 59 + (i - 1),
         case when i <= 5
           then array[today - 59 + (i - 1), today - 58 + (i - 1), today - 57 + (i - 1), today - 56 + (i - 1), today - 55 + (i - 1)]
           else array[today - 59 + (i - 1)]
         end
  from generate_series(1, 10) as i;

  -- One install whose 30 days ended 6 days ago: closed, but not yet old enough to pay.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  values (g, m1, encode(sha256(convert_to('recent', 'UTF8')), 'hex'), today - 35, array[today - 35]);

  -- Member two: three ordinary installs, nothing unusual.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m2, encode(sha256(convert_to('two-' || i, 'UTF8')), 'hex'), today - 45 + i, array[today - 45 + i]
  from generate_series(1, 3) as i;

  -- Settled: window closed at least 7 days ago. Member one's 40 qualify (35 returned), the
  -- install from 35 days ago does not, member two's three do.
  select * into settled_row from public.marketing_admin_settled(today, 7) s where s.group_id = g;
  assert settled_row.installs = 43, 'settled: installs old enough to pay';
  assert settled_row.retained = 35, 'settled: five-day people among them';
  select * into settled_row from public.marketing_admin_settled(today, 0) s where s.group_id = g;
  assert settled_row.installs = 44, 'settled: with no waiting, every closed install counts';

  -- Flags.
  select count(*) into n from public.marketing_admin_flags(today) f
    where f.group_id = g and f.member_id = m1 and f.kind = 'spike' and f.flagged_on = today - 60;
  assert n = 1, 'flags: a day with a sudden burst of installs';
  select count(*) into n from public.marketing_admin_flags(today) f
    where f.group_id = g and f.member_id = m1 and f.kind = 'high_return';
  assert n = 1, 'flags: an unusually high share of five-day people';
  select count(*) into n from public.marketing_admin_flags(today) f where f.group_id = g and f.member_id = m2;
  assert n = 0, 'flags: an ordinary member is not flagged';

  -- A small burst is not a spike.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m2, encode(sha256(convert_to('small-' || i, 'UTF8')), 'hex'), today - 20, array[today - 20]
  from generate_series(1, 24) as i;
  select count(*) into n from public.marketing_admin_flags(today) f where f.group_id = g and f.member_id = m2;
  assert n = 0, 'flags: 24 installs in a day is under the limit';

  -- The Play Console number cannot be negative.
  begin
    update public.marketing_groups set play_console_installs = -1 where id = g;
    assert false, 'a negative Play Console number must be refused';
  exception when check_violation then
    null;
  end;
  update public.marketing_groups set play_console_installs = 40, play_console_checked_on = today where id = g;

  -- Only admins get answers.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
  select count(*) into n from public.marketing_admin_settled(today, 7);
  assert n = 0, 'a person who is not an admin gets no settled counts';
  select count(*) into n from public.marketing_admin_flags(today);
  assert n = 0, 'a person who is not an admin gets no flags';

  raise notice 'marketing pay checks: all checks passed';
end;
$$;

rollback;
