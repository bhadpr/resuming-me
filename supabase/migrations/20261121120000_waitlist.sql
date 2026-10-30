-- iPhone launch waitlist and school-district waitlist.
-- Written only by the join-waitlist Edge Function (service role).
-- No anon or authenticated policies: the table is not readable from the browser.

create table if not exists public.waitlist (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source       text not null check (source in ('iphone', 'school_holidays_waitlist')),
  zip          text check (zip is null or zip ~ '^\d{5}$'),
  page_path    text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  language     text,
  ip_hash      text,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  unique (email, source)
);

create index if not exists waitlist_source_created_idx on public.waitlist (source, created_at);
create index if not exists waitlist_ip_hash_created_idx on public.waitlist (ip_hash, created_at);

alter table public.waitlist enable row level security;

-- School ZIP lookup for the marketing site. School lists have ZIP codes and no search keys.
-- League and cricket lists also store ZIP codes, and they set search_keys, so they stay out.
-- security_invoker off: anon can read this view without a grant on shared_lists.

create or replace view public.covered_school_zips
with (security_invoker = false) as
select distinct
  zip,
  title as district_name
from public.shared_lists
cross join lateral unnest(zip_codes) as zip
where status = 'active'
  and cardinality(zip_codes) > 0
  and cardinality(search_keys) = 0;

grant select on public.covered_school_zips to anon, authenticated;
