-- One birthday email when the person has not opened the app for 30 days.
-- Same email switch as the day 2, 3, and 7 notes. Quiet hours 22:00–07:00.
-- Skipped when a check-in or weekly review email already went out that local day.

create table if not exists public.birthday_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, sent_on)
);

alter table public.birthday_emails enable row level security;

create or replace function public.due_birthday_emails(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  timezone text,
  local_date date,
  checkin_token uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with local as (
    select
      p.id,
      u.email::text as email,
      coalesce(nullif(p.timezone, ''), 'UTC') as tz,
      p.checkin_token,
      p.birthday,
      u.last_sign_in_at,
      (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC')) as local_now
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.birthday is not null
      and p.onboarding_completed_at is not null
      and p.checkins_opt_out = false
      and u.email is not null
  ),
  today as (
    select
      l.*,
      l.local_now::date as local_date,
      extract(hour from l.local_now)::int as local_hour
    from local l
  )
  select t.id, t.email, t.tz, t.local_date, t.checkin_token
  from today t
  where extract(month from t.birthday)::int = extract(month from t.local_date)::int
    and extract(day from t.birthday)::int = extract(day from t.local_date)::int
    and t.local_hour >= 7
    and t.local_hour < 22
    and coalesce(t.last_sign_in_at, '-infinity'::timestamptz) < p_now - interval '30 days'
    and not exists (
      select 1 from public.events e
      where e.user_id = t.id
        and e.name = 'app_opened'
        and e.created_at >= p_now - interval '30 days'
    )
    and not exists (
      select 1 from public.log_entries le
      where le.user_id = t.id
        and le.date >= (t.local_date - 30)
    )
    and not exists (
      select 1 from public.birthday_emails b
      where b.user_id = t.id
        and b.sent_on = t.local_date
    )
    and not exists (
      select 1 from public.checkin_deliveries d
      where d.user_id = t.id
        and (d.sent_at at time zone t.tz)::date = t.local_date
    )
    and not exists (
      select 1 from public.weekly_reviews wr
      where wr.user_id = t.id
        and wr.emailed_at is not null
        and (wr.emailed_at at time zone t.tz)::date = t.local_date
    );
$$;

revoke all on function public.due_birthday_emails(timestamptz) from public, anon, authenticated;
grant execute on function public.due_birthday_emails(timestamptz) to service_role;

comment on function public.due_birthday_emails(timestamptz) is
  'Birthday email for someone away 30 days. Call from send-check-ins after that hour''s check-ins.';
