-- Thanksgiving 2026 is the fourth Thursday, 26 November.

insert into public.community_reminders (titles, day, remind_before, remind_week_before, kind, active)
select
  jsonb_build_object(
    'en', 'Thanksgiving',
    'hi', 'थैंक्सगिविंग',
    'te', 'థాంక్స్‌గివింగ్',
    'gu', 'થેન્ક્સગિવિંગ',
    'mr', 'थँक्सगिव्हिंग',
    'ta', 'தாங்க்ஸ்கிவிங்',
    'bn', 'থ্যাঙ্কসগিভিং'
  ),
  date '2026-11-26',
  true,
  true,
  'event',
  true
where not exists (
  select 1 from public.community_reminders where lower(titles ->> 'en') like '%thank%'
);
