-- Checks the pay checks and the account rule for referral groups (migrations
-- 20261021120000_marketing_pay_checks.sql and 20261027120000_marketing_retained_accounts.sql).
-- Needs both migrations applied first.
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_marketing_pay_checks.sql
-- It adds test users, a test group and installs inside one transaction, checks the results, and
-- rolls everything back, so nothing is kept. A failed check stops with its name.

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
  g_code text;
  m1 uuid;
  m2 uuid;
  m1_code text;
  uids uuid[];
  settled_row record;
  counts_row record;
  linked uuid;
  n integer;
begin
  -- Sixty throwaway accounts. A retained person needs one.
  insert into auth.users (id, email)
  select gen_random_uuid(), 'pay-check-' || i || '@example.invalid'
  from generate_series(1, 60) as i;
  select array_agg(id order by email) into uids
  from auth.users where email like 'pay-check-%@example.invalid';
  assert cardinality(uids) = 60, 'setup: sixty test accounts';

  insert into public.marketing_groups (name) values ('test pay checks') returning id, code into g, g_code;
  insert into public.marketing_members (group_id, email) values (g, 'one@example.invalid') returning id, code into m1, m1_code;
  insert into public.marketing_members (group_id, email) values (g, 'two@example.invalid') returning id into m2;

  -- Member one: 30 installs on a single day 60 days ago, every one opened on five days and
  -- linked to an account.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days, user_id)
  select g, m1, encode(sha256(convert_to('spike-' || i, 'UTF8')), 'hex'), today - 60,
         array[today - 60, today - 59, today - 58, today - 57, today - 56],
         uids[i]
  from generate_series(1, 30) as i;

  -- Ten ordinary installs, one a day. Five opened on five days, but only four of those have an
  -- account (the fifth is a device with no account, which must not count).
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days, user_id)
  select g, m1, encode(sha256(convert_to('single-' || i, 'UTF8')), 'hex'), today - 59 + (i - 1),
         case when i <= 5
           then array[today - 59 + (i - 1), today - 58 + (i - 1), today - 57 + (i - 1), today - 56 + (i - 1), today - 55 + (i - 1)]
           else array[today - 59 + (i - 1)]
         end,
         case when i <= 4 then uids[30 + i] else null end
  from generate_series(1, 10) as i;

  -- One install whose 30 days ended 6 days ago: closed, but not yet old enough to pay.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  values (g, m1, encode(sha256(convert_to('recent', 'UTF8')), 'hex'), today - 35, array[today - 35]);

  -- Member two: three ordinary installs, nothing unusual.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m2, encode(sha256(convert_to('two-' || i, 'UTF8')), 'hex'), today - 45 + i, array[today - 45 + i]
  from generate_series(1, 3) as i;

  -- One account cannot be linked to two installs.
  begin
    insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days, user_id)
    values (g, m2, encode(sha256(convert_to('twice', 'UTF8')), 'hex'), today - 45, array[today - 45], uids[1]);
    assert false, 'the same account must not be linked to two installs';
  exception when unique_violation then
    null;
  end;

  -- Settled: window closed at least 7 days ago. Member one's 40 qualify (34 retained: 30 + 4
  -- with an account; the five-day device with no account is not counted), the install from 35
  -- days ago does not, member two's three do.
  select * into settled_row from public.marketing_admin_settled(today, 7) s where s.group_id = g;
  assert settled_row.installs = 43, 'settled: installs old enough to pay';
  assert settled_row.retained = 34, 'settled: only people with an account and five days';
  select * into settled_row from public.marketing_admin_settled(today, 0) s where s.group_id = g;
  assert settled_row.installs = 44, 'settled: with no waiting, every closed install counts';

  -- The member counts add up: a five-day device with no account is "ended short", not retained.
  select * into counts_row from public.marketing_counts(g, m1, today);
  assert counts_row.installs = 41, 'counts: member one installs';
  assert counts_row.retained = 34, 'counts: member one retained';
  assert counts_row.ended_short = 7, 'counts: member one ended short, including the five-day device with no account';
  assert counts_row.in_progress = 0, 'counts: member one has none still open';
  assert counts_row.installs = counts_row.in_progress + counts_row.retained + counts_row.ended_short,
    'counts: the three buckets add up to installs';

  -- A five-day device with no account is still "in progress" while its 30 days run.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  values (g, m2, encode(sha256(convert_to('open-window', 'UTF8')), 'hex'), today - 5,
          array[today - 5, today - 4, today - 3, today - 2, today - 1]);
  select * into counts_row from public.marketing_counts(g, m2, today);
  assert counts_row.retained = 0, 'counts: five days without an account is not retained';
  assert counts_row.in_progress = 1, 'counts: it stays in progress until the window ends';
  delete from public.marketing_installs where device_key = encode(sha256(convert_to('open-window', 'UTF8')), 'hex');

  -- Flags.
  select count(*) into n from public.marketing_admin_flags(today) f
    where f.group_id = g and f.member_id = m1 and f.kind = 'spike' and f.flagged_on = today - 60;
  assert n = 1, 'flags: a day with a sudden burst of installs';
  select count(*) into n from public.marketing_admin_flags(today) f
    where f.group_id = g and f.member_id = m1 and f.kind = 'high_return';
  assert n = 1, 'flags: an unusually high share of retained people';
  select count(*) into n from public.marketing_admin_flags(today) f where f.group_id = g and f.member_id = m2;
  assert n = 0, 'flags: an ordinary member is not flagged';

  -- A small burst is not a spike.
  insert into public.marketing_installs (group_id, member_id, device_key, started_on, open_days)
  select g, m2, encode(sha256(convert_to('small-' || i, 'UTF8')), 'hex'), today - 20, array[today - 20]
  from generate_series(1, 24) as i;
  select count(*) into n from public.marketing_admin_flags(today) f where f.group_id = g and f.member_id = m2;
  assert n = 0, 'flags: 24 installs in a day is under the limit';

  -- The account link, made by the app's daily call.
  -- A signed-out first open records the install with no account.
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-a', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-a', 'UTF8')), 'hex');
  assert found, 'record_open: the first open creates the install';
  assert linked is null, 'record_open: a signed-out first open has no account';

  -- The same device, signed in, is linked to that account.
  perform set_config('request.jwt.claim.sub', uids[41]::text, true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-a', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-a', 'UTF8')), 'hex');
  assert linked = uids[41], 'record_open: a signed-in open links the account';

  -- Another account on the same device does not replace the link.
  perform set_config('request.jwt.claim.sub', uids[42]::text, true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-a', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-a', 'UTF8')), 'hex');
  assert linked = uids[41], 'record_open: the first account stays linked';

  -- The same account on a second device is not linked a second time, and the call does not fail.
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-b', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  perform set_config('request.jwt.claim.sub', uids[41]::text, true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-b', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-b', 'UTF8')), 'hex');
  assert linked is null, 'record_open: one account is linked to one install only';

  -- A signed-in first open is linked straight away.
  perform set_config('request.jwt.claim.sub', uids[43]::text, true);
  perform public.marketing_record_open(encode(sha256(convert_to('phone-c', 'UTF8')), 'hex'), g_code, m1_code, current_date);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-c', 'UTF8')), 'hex');
  assert linked = uids[43], 'record_open: a signed-in first open is linked';

  -- Deleting an account's usage clears the link but keeps the install.
  perform public.erase_user_usage(uids[43]);
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-c', 'UTF8')), 'hex');
  assert found and linked is null, 'erase_user_usage: the install stays and the link is removed';

  -- Deleting the account itself does the same through the foreign key.
  delete from auth.users where id = uids[41];
  select user_id into linked from public.marketing_installs
    where device_key = encode(sha256(convert_to('phone-a', 'UTF8')), 'hex');
  assert found and linked is null, 'deleting the account removes the link';

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
