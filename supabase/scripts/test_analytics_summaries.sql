-- Checks the admin analytics functions (migration 20261020120000_analytics_summaries.sql).
-- Needs that migration applied first.
--
-- Run it against the linked project:
--   supabase db query --linked -f supabase/scripts/test_analytics_summaries.sql
-- It adds test events and a test user inside one transaction, compares the totals before and
-- after, and rolls everything back, so nothing is kept. A failed check stops with its name.
-- Real data stays in the totals, so each check compares the change, not the absolute number.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where is_admin limit 1),
  true
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'analytics-test-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'analytics-test-b@example.invalid');

do $$
declare
  ua constant uuid := '00000000-0000-0000-0000-0000000000a1';
  ub constant uuid := '00000000-0000-0000-0000-0000000000b1';
  today constant timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  d3 constant timestamptz := today - interval '3 days' + interval '10 hours';
  old_signup constant timestamptz := today - interval '80 days' + interval '10 hours';
  onb_b jsonb; onb_a jsonb;
  jny_b jsonb; jny_a jsonb;
  rem_b jsonb; rem_a jsonb;
  lp_b jsonb; lp_a jsonb;
  old_week date := date_trunc('week', old_signup at time zone 'utc')::date;
  cohort jsonb;
  recent jsonb;
begin
  onb_b := public.onboarding_funnel_summary(7);
  -- Onboarding: two people start, one finishes the timer fast and signs up, then logs on day 2.
  insert into public.events (anon_id, user_id, name, props, created_at) values
    ('t-onb-aaaaaa', null, 'onboarding_started', '{}', d3),
    ('t-onb-bbbbbb', null, 'onboarding_started', '{}', d3 + interval '1 hour'),
    ('t-onb-aaaaaa', null, 'onboarding_step_completed', '{"step": 1}', d3 + interval '1 minute'),
    ('t-onb-aaaaaa', null, 'onboarding_timer_completed', '{"seconds": 120}', d3 + interval '2 minutes'),
    ('t-onb-bbbbbb', null, 'onboarding_timer_completed', '{"seconds": 90}', d3 + interval '1 hour 4 minutes'),
    ('t-onb-aaaaaa', ua, 'signup_completed', '{}', d3 + interval '5 minutes'),
    ('t-onb-aaaaaa', ua, 'log_created', '{}', d3 + interval '2 days');
  onb_a := public.onboarding_funnel_summary(7);
  assert (onb_a->>'started')::int - (onb_b->>'started')::int = 2, 'onboarding: started';
  assert (onb_a->'steps'->0->>'people')::int - (onb_b->'steps'->0->>'people')::int = 1, 'onboarding: step 1';
  assert (onb_a->>'timerCompleted')::int - (onb_b->>'timerCompleted')::int = 2, 'onboarding: timer completed';
  assert (onb_a->>'signups')::int - (onb_b->>'signups')::int = 1, 'onboarding: signups';
  assert (onb_a->>'loggedDay2')::int - (onb_b->>'loggedDay2')::int = 1, 'onboarding: logged on day 2';
  assert (onb_a->>'loggedDay7')::int - (onb_b->>'loggedDay7')::int = 0, 'onboarding: not logged on day 7';

  jny_b := public.guest_journey_summary(7);
  -- Guest journey: counted by anonymous id, catalog and custom creates.
  insert into public.events (anon_id, user_id, name, props, created_at) values
    ('t-jny-aaaaaa', null, 'landing_viewed', '{}', d3),
    ('t-jny-aaaaaa', null, 'landing_viewed', '{}', d3),
    ('t-jny-aaaaaa', null, 'intent_journey_started', '{}', d3),
    ('t-jny-aaaaaa', null, 'onboarding_started', '{}', d3),
    ('t-jny-aaaaaa', null, 'onboarding_step_completed', '{"step": 1}', d3),
    ('t-jny-aaaaaa', ua, 'log_created', '{"signed_in": false}', d3),
    ('t-jny-bbbbbb', ub, 'log_created', '{"signed_in": true}', d3),
    ('t-jny-aaaaaa', null, 'signin_shown', '{}', d3),
    ('t-jny-aaaaaa', ua, 'signup_completed', '{}', d3),
    ('t-jny-aaaaaa', null, 'activity_created', '{"template_id": "walk"}', d3),
    ('t-jny-aaaaaa', null, 'activity_created', '{"template_id": "custom"}', d3),
    ('t-jny-cccccc', null, 'metric_created', '{"template_id": "weight"}', d3),
    ('t-jny-cccccc', null, 'metric_created', '{"template_id": "custom"}', d3),
    ('t-jny-oldold', null, 'activity_created', '{}', d3);
  jny_a := public.guest_journey_summary(7);
  assert (jny_a#>>'{journey,landing}')::int - (jny_b#>>'{journey,landing}')::int = 1, 'journey: landing';
  assert (jny_a#>>'{journey,intentStarted}')::int - (jny_b#>>'{journey,intentStarted}')::int = 1, 'journey: intent started';
  assert (jny_a#>>'{journey,setupStarted}')::int - (jny_b#>>'{journey,setupStarted}')::int = 1, 'journey: setup started';
  assert (jny_a#>>'{journey,habitsPicked}')::int - (jny_b#>>'{journey,habitsPicked}')::int = 1, 'journey: habits picked';
  assert (jny_a#>>'{journey,firstLog}')::int - (jny_b#>>'{journey,firstLog}')::int = 1, 'journey: first log as a guest';
  assert (jny_a#>>'{journey,signInShown}')::int - (jny_b#>>'{journey,signInShown}')::int = 1, 'journey: sign-in shown';
  assert (jny_a#>>'{journey,signups}')::int - (jny_b#>>'{journey,signups}')::int = 1, 'journey: signups';
  assert (jny_a#>>'{creates,habitsCatalog}')::int - (jny_b#>>'{creates,habitsCatalog}')::int = 1, 'creates: habit from catalog';
  assert (jny_a#>>'{creates,habitsCustom}')::int - (jny_b#>>'{creates,habitsCustom}')::int = 1, 'creates: custom habit';
  assert (jny_a#>>'{creates,vitalsCatalog}')::int - (jny_b#>>'{creates,vitalsCatalog}')::int = 1, 'creates: vital from catalog';
  assert (jny_a#>>'{creates,vitalsCustom}')::int - (jny_b#>>'{creates,vitalsCustom}')::int = 1, 'creates: custom vital';

  rem_b := public.reminder_analytics_summary(7);
  -- Reminders and shared events.
  insert into public.events (anon_id, user_id, name, props, created_at) values
    ('t-rem-a1aaaa', ua, 'reminder_added', '{"has_time": true, "day_before": true, "kind": "doctor", "every_year": false, "signed_in": true}', d3),
    ('t-rem-a2aaaa', null, 'reminder_added', '{"has_time": false, "kind": "event", "every_year": true, "signed_in": false}', d3),
    ('t-rem-a2aaaa', null, 'reminder_added', '{"has_time": false}', d3),
    ('t-rem-a1aaaa', ua, 'reminder_done', '{"signed_in": true, "from": "notification"}', d3),
    ('t-rem-a3aaaa', null, 'reminder_done', '{}', d3),
    ('t-rem-a1aaaa', ua, 'shared_event_created', '{}', d3),
    ('t-rem-a2aaaa', null, 'shared_event_viewed', '{}', d3),
    ('t-rem-a3aaaa', null, 'shared_event_viewed', '{}', d3),
    ('t-rem-a2aaaa', null, 'shared_event_added', '{}', d3),
    ('t-rem-a3aaaa', null, 'shared_event_installed', '{}', d3),
    ('t-rem-a4aaaa', null, 'shared_event_reported', '{"reason": "spam"}', d3);
  rem_a := public.reminder_analytics_summary(7);
  assert (rem_a->>'added')::int - (rem_b->>'added')::int = 3, 'reminders: added';
  assert (rem_a->>'done')::int - (rem_b->>'done')::int = 2, 'reminders: done';
  assert (rem_a->>'people')::int - (rem_b->>'people')::int = 3, 'reminders: people (shared events do not count)';
  assert (rem_a->>'withTime')::int - (rem_b->>'withTime')::int = 1, 'reminders: with a time';
  assert (rem_a->>'dayBefore')::int - (rem_b->>'dayBefore')::int = 1, 'reminders: day before';
  assert (rem_a->>'everyYear')::int - (rem_b->>'everyYear')::int = 1, 'reminders: every year';
  assert (rem_a->>'signedIn')::int - (rem_b->>'signedIn')::int = 1, 'reminders: signed in';
  assert (rem_a->>'doneFromNotification')::int - (rem_b->>'doneFromNotification')::int = 1, 'reminders: done from a notification';
  assert (rem_a#>>'{shared,created}')::int - (rem_b#>>'{shared,created}')::int = 1, 'shared: created';
  assert (rem_a#>>'{shared,opened}')::int - (rem_b#>>'{shared,opened}')::int = 2, 'shared: opened';
  assert (rem_a#>>'{shared,added}')::int - (rem_b#>>'{shared,added}')::int = 1, 'shared: added';
  assert (rem_a#>>'{shared,installs}')::int - (rem_b#>>'{shared,installs}')::int = 1, 'shared: installs';
  assert (rem_a#>>'{shared,reported}')::int - (rem_b#>>'{shared,reported}')::int = 1, 'shared: reported';

  lp_b := public.loop_analytics_summary(90);
  -- Comeback loop: a returns twice and saw the welcome card, b returns without it.
  insert into public.events (anon_id, user_id, name, props, created_at) values
    ('t-lp-aaaaaaa', ua, 'comeback', '{}', today - interval '7 days'),
    ('t-lp-aaaaaaa', ua, 'comeback', '{}', today),
    ('t-lp-aaaaaaa', ua, 'welcome_back_shown', '{}', today),
    ('t-lp-bbbbbbb', ub, 'comeback', '{}', today - interval '5 days'),
    ('t-lp-aaaaaaa', ua, 'review_generated', '{}', today - interval '1 day'),
    ('t-lp-bbbbbbb', ub, 'review_generated', '{}', today - interval '1 day'),
    ('t-lp-aaaaaaa', ua, 'review_opened', '{}', today - interval '1 day'),
    ('t-lp-aaaaaaa', ua, 'review_focus_set', '{}', today - interval '1 day');
  -- Cohorts: a signed up 80 days ago (twice, counted once), showed up in week 2 and week 8 only.
  insert into public.events (anon_id, user_id, name, props, created_at) values
    ('t-lp-aaaaaaa', ua, 'signup_completed', '{}', old_signup),
    ('t-lp-aaaaaaa', ua, 'signup_completed', '{}', old_signup + interval '1 day'),
    ('t-lp-aaaaaaa', ua, 'log_created', '{}', old_signup + interval '10 days'),
    ('t-lp-aaaaaaa', ua, 'app_opened', '{}', old_signup + interval '50 days'),
    ('t-lp-bbbbbbb', ub, 'signup_completed', '{}', today - interval '1 day');
  lp_a := public.loop_analytics_summary(90);
  assert (lp_a->>'comebacks')::int - (lp_b->>'comebacks')::int = 3, 'loop: comebacks';
  assert (lp_a->>'returnedWithCard')::int - (lp_b->>'returnedWithCard')::int = 1, 'loop: returned with the card';
  assert (lp_a->>'returnedWithoutCard')::int - (lp_b->>'returnedWithoutCard')::int = 1, 'loop: returned without the card';
  assert (lp_a->>'reviewsGenerated')::int - (lp_b->>'reviewsGenerated')::int = 2, 'loop: reviews generated';
  assert (lp_a->>'reviewsOpened')::int - (lp_b->>'reviewsOpened')::int = 1, 'loop: reviews opened';
  assert (lp_a->>'openedUsers')::int - (lp_b->>'openedUsers')::int = 1, 'loop: people who opened a review';
  assert (lp_a->>'actedUsers')::int - (lp_b->>'actedUsers')::int = 1, 'loop: people who acted on a review';

  select c into cohort from jsonb_array_elements(lp_a->'cohorts') c where c->>'weekStart' = old_week::text;
  assert cohort is not null, 'cohort: week of the old sign-up exists';
  assert (cohort->>'size')::int = 1, 'cohort: a person who signed up twice counts once';
  assert (cohort->>'week2')::float8 = 1, 'cohort: showed up in week 2';
  assert (cohort->>'week4')::float8 = 0, 'cohort: did not show up in week 4';
  assert (cohort->>'week8')::float8 = 1, 'cohort: showed up in week 8';
  select c into recent from jsonb_array_elements(lp_a->'cohorts') c
    where c->>'weekStart' = date_trunc('week', (today - interval '1 day') at time zone 'utc')::date::text;
  assert recent->'week2' = 'null'::jsonb, 'cohort: a week that has not ended stays empty';

  -- The functions are for admins only.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  begin
    perform public.loop_analytics_summary(90);
    assert false, 'a person who is not an admin must be refused';
  exception when others then
    assert sqlerrm = 'not authorized', 'a person who is not an admin must be refused';
  end;

  raise notice 'analytics summaries: all checks passed';
end;
$$;

rollback;
