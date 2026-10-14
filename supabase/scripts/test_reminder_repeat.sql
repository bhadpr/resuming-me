-- Checks for repeating reminders. Run them inside one transaction that is rolled back, with the
-- migration first so it is tested too:
--
--   begin;
--   <supabase/migrations/20261022120000_reminder_repeat.sql>
--   <this file>
--   rollback;
--
-- Each check raises with its name when it fails, and the script ends with 'ok'.

do $$
declare
  uid uuid := 'da999a92-229d-4376-8918-aec77ffef445';
  rid uuid;
  items jsonb;
begin
  -- A valid repeat: one month, from the first day.
  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT daily', date '2030-01-10', 'day', date '2030-01-10', date '2030-02-10')
  returning id into rid;

  -- Two months exactly is allowed, a day more is not.
  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT limit', date '2030-01-10', 'week', date '2030-01-10', date '2030-03-10');

  begin
    insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
    values (uid, 'RT too long', date '2030-01-10', 'day', date '2030-01-10', date '2030-03-11');
    raise exception 'check window: over two months was accepted';
  exception when check_violation then null;
  end;

  -- The limit counts from the first day of the repeat, not from the stored next day.
  begin
    update public.reminders set repeat_until = date '2030-03-11' where id = rid;
    raise exception 'check window: extending past two months from the first day was accepted';
  exception when check_violation then null;
  end;

  -- End date before the first day.
  begin
    insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
    values (uid, 'RT backwards', date '2030-01-10', 'day', date '2030-01-10', date '2030-01-09');
    raise exception 'check window: end before start was accepted';
  exception when check_violation then null;
  end;

  -- Only day and week.
  begin
    insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
    values (uid, 'RT month', date '2030-01-10', 'month', date '2030-01-10', date '2030-02-10');
    raise exception 'check kind: month was accepted';
  exception when check_violation then null;
  end;

  -- The three columns go together.
  begin
    insert into public.reminders (user_id, text, day, repeat_every)
    values (uid, 'RT half', date '2030-01-10', 'day');
    raise exception 'check set: repeat without dates was accepted';
  exception when check_violation then null;
  end;

  -- Not with every year.
  begin
    insert into public.reminders (user_id, text, day, every_year, repeat_every, repeat_from, repeat_until)
    values (uid, 'RT yearly', date '2030-01-10', true, 'day', date '2030-01-10', date '2030-02-10');
    raise exception 'check alone: every year with a repeat was accepted';
  exception when check_violation then null;
  end;

  -- Moving the stored day forward, as Done does, still passes.
  update public.reminders set day = date '2030-01-11', last_done_on = date '2030-01-10' where id = rid;

  -- reminder_due_on
  assert public.reminder_due_on(date '2030-01-10', null, null, date '2030-01-10'), 'due: one-time on its day';
  assert not public.reminder_due_on(date '2030-01-10', null, null, date '2030-01-11'), 'due: one-time the day after';
  assert public.reminder_due_on(date '2030-01-10', 'day', date '2030-02-10', date '2030-01-25'), 'due: daily mid-way';
  assert not public.reminder_due_on(date '2030-01-10', 'day', date '2030-02-10', date '2030-02-11'), 'due: daily after end';
  assert not public.reminder_due_on(date '2030-01-10', 'day', date '2030-02-10', date '2030-01-09'), 'due: daily before start';
  assert public.reminder_due_on(date '2030-01-10', 'week', date '2030-02-10', date '2030-01-24'), 'due: weekly on a week step';
  assert not public.reminder_due_on(date '2030-01-10', 'week', date '2030-02-10', date '2030-01-25'), 'due: weekly off a step';
  assert public.reminder_due_on(date '2030-01-10', 'week', date '2030-02-10', date '2030-02-07'), 'due: weekly on the last step';

  -- The morning email lists a repeat that is due, even when its stored day is old.
  delete from public.reminders where user_id = uid and text like 'RT %';
  update public.profiles set reminder_emails = true, timezone = 'UTC' where id = uid;
  delete from public.reminder_emails where user_id = uid and sent_on = date '2030-01-15';

  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT email daily', date '2030-01-10', 'day', date '2030-01-10', date '2030-02-10');
  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT email weekly off', date '2030-01-10', 'week', date '2030-01-10', date '2030-02-10');
  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT email weekly on', date '2030-01-08', 'week', date '2030-01-08', date '2030-02-08');
  insert into public.reminders (user_id, text, day, repeat_every, repeat_from, repeat_until)
  values (uid, 'RT email ended', date '2029-12-01', 'day', date '2029-12-01', date '2030-01-10');
  insert into public.reminders (user_id, text, day)
  values (uid, 'RT email once', date '2030-01-15');

  select r.items into items
  from public.due_reminder_emails(timestamptz '2030-01-15 08:00:00+00') r
  where r.user_id = uid;

  assert items is not null, 'email: nothing listed for a due repeat';
  assert items @> '[{"text": "RT email daily"}]'::jsonb, 'email: daily repeat missing';
  assert items @> '[{"text": "RT email weekly on"}]'::jsonb, 'email: weekly repeat on its day missing';
  assert items @> '[{"text": "RT email once"}]'::jsonb, 'email: one-time reminder missing';
  assert not (items @> '[{"text": "RT email weekly off"}]'::jsonb), 'email: weekly repeat off its day listed';
  assert not (items @> '[{"text": "RT email ended"}]'::jsonb), 'email: ended repeat listed';
end;
$$;

select 'ok' as reminder_repeat_checks;
