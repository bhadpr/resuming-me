-- Website numbers for resuming.app. Read-only.
-- Run in the Supabase SQL editor, or: supabase db query --linked -f supabase/scripts/site_analytics.sql
-- The site writes two kinds of rows to public.events (platform = 'website'):
--   site_viewed       one per page load      props: lang, referrer_host, utm_source, utm_medium, utm_campaign, device
--   site_cta_clicked  a tap on a link         props: kind (play | web), where (header | hero | final | try | page)

-- 1. Visitors and page views per day, last 14 days.
select
  (created_at at time zone 'utc')::date as day,
  count(*) filter (where name = 'site_viewed') as page_views,
  count(distinct anon_id) filter (where name = 'site_viewed') as visitors
from public.events
where platform = 'website' and created_at >= now() - interval '14 days'
group by 1
order by 1 desc;

-- 2. Where visitors come from, last 30 days.
-- A link you tagged (?utm_source=...) wins; otherwise the website they came from; otherwise direct.
select
  coalesce(props->>'utm_source', props->>'referrer_host', 'direct') as source,
  props->>'utm_medium' as medium,
  props->>'utm_campaign' as campaign,
  count(distinct anon_id) as visitors
from public.events
where platform = 'website' and name = 'site_viewed' and created_at >= now() - interval '30 days'
group by 1, 2, 3
order by visitors desc;

-- 3. What they tapped, last 30 days. "play" is the Google Play button, "web" is Try it in your browser.
select
  props->>'kind' as button,
  props->>'where' as place,
  count(*) as taps,
  count(distinct anon_id) as people
from public.events
where platform = 'website' and name = 'site_cta_clicked' and created_at >= now() - interval '30 days'
group by 1, 2
order by taps desc;

-- 4. Per source: visitors, and how many of them tapped Play or the browser button.
with visits as (
  select anon_id, coalesce(props->>'utm_source', props->>'referrer_host', 'direct') as source
  from public.events
  where platform = 'website' and name = 'site_viewed' and created_at >= now() - interval '30 days'
  group by 1, 2
),
taps as (
  select anon_id, props->>'kind' as kind
  from public.events
  where platform = 'website' and name = 'site_cta_clicked' and created_at >= now() - interval '30 days'
  group by 1, 2
)
select
  v.source,
  count(distinct v.anon_id) as visitors,
  count(distinct t.anon_id) filter (where t.kind = 'play') as tapped_play,
  count(distinct t.anon_id) filter (where t.kind = 'web') as tapped_browser,
  round(100.0 * count(distinct t.anon_id) filter (where t.kind = 'play') / nullif(count(distinct v.anon_id), 0), 1) as play_pct
from visits v
left join taps t using (anon_id)
group by 1
order by visitors desc;
