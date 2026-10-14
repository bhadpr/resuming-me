-- Names for the 2026 community days, in every app language.
-- Existing Diwali and Vijayadashmi rows keep their pictures. The other three are added if missing.

update public.community_reminders
set titles = jsonb_build_object(
  'en', 'Vijayadashmi',
  'hi', 'विजयादशमी',
  'te', 'విజయదశమి',
  'gu', 'વિજયાદશમી',
  'mr', 'विजयादशमी',
  'ta', 'விஜயதசமி',
  'bn', 'বিজয়াদশমী'
)
where lower(titles ->> 'en') like '%vijaya%';

update public.community_reminders
set titles = jsonb_build_object(
  'en', 'Diwali',
  'hi', 'दिवाली',
  'te', 'దీపావళి',
  'gu', 'દિવાળી',
  'mr', 'दिवाळी',
  'ta', 'தீபாவளி',
  'bn', 'দীপাবলি'
)
where lower(titles ->> 'en') like '%diwali%';

insert into public.community_reminders (titles, day, remind_before, remind_week_before, kind, active)
select
  jsonb_build_object(
    'en', 'Halloween',
    'hi', 'हैलोवीन',
    'te', 'హాలోవీన్',
    'gu', 'હેલોવીન',
    'mr', 'हॅलोवीन',
    'ta', 'ஹாலோவீன்',
    'bn', 'হ্যালোউইন'
  ),
  date '2026-10-31',
  true,
  true,
  'event',
  true
where not exists (
  select 1 from public.community_reminders where lower(titles ->> 'en') like '%halloween%'
);

insert into public.community_reminders (titles, day, remind_before, remind_week_before, kind, active)
select
  jsonb_build_object(
    'en', 'Guru Nanak Jayanti',
    'hi', 'गुरु नानक जयंती',
    'te', 'గురు నానక్ జయంతి',
    'gu', 'ગુરુ નાનક જયંતી',
    'mr', 'गुरु नानक जयंती',
    'ta', 'குரு நானக் ஜயந்தி',
    'bn', 'গুরু নানক জয়ন্তী'
  ),
  date '2026-11-24',
  true,
  true,
  'event',
  true
where not exists (
  select 1 from public.community_reminders where lower(titles ->> 'en') like '%nanak%'
);

insert into public.community_reminders (titles, day, remind_before, remind_week_before, kind, active)
select
  jsonb_build_object(
    'en', 'Christmas',
    'hi', 'क्रिसमस',
    'te', 'క్రిస్మస్',
    'gu', 'નાતાલ',
    'mr', 'नाताळ',
    'ta', 'கிறிஸ்துமஸ்',
    'bn', 'বড়দিন'
  ),
  date '2026-12-25',
  true,
  true,
  'event',
  true
where not exists (
  select 1 from public.community_reminders where lower(titles ->> 'en') like '%christmas%'
);
