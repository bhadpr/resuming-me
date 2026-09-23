-- Days a habit is not scheduled, check-ins at the chosen hour, and who needs a weekly review.

alter table public.activities
  add column if not exists off_weekdays smallint[] not null default '{}';

alter table public.activities
  drop constraint if exists activities_off_weekdays_check;

alter table public.activities
  add constraint activities_off_weekdays_check
  check (off_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- Day 2 / 3 / 7, after the reminder hour, outside 22:00–07:00.
create or replace function public.due_checkins(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  day_n integer,
  timezone text,
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
      p.reminder_time,
      (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC')) as local_now,
      (
        (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
        - (p.onboarding_completed_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      ) as day_span
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.onboarding_completed_at is not null
      and p.checkins_opt_out = false
      and u.email is not null
  )
  select l.id, l.email, l.day_span, l.tz, l.checkin_token
  from local l
  where l.day_span in (2, 3, 7)
    and (extract(hour from l.local_now) < 22 and extract(hour from l.local_now) >= 7)
    and (
      coalesce(l.reminder_time, '') = ''
      or extract(hour from l.local_now) >= split_part(l.reminder_time, ':', 1)::int
    )
    and (
      select count(*) from public.checkin_deliveries d
      where d.user_id = l.id and d.opened_at is null
    ) < 3
    and not exists (
      select 1 from public.checkin_deliveries d
      where d.user_id = l.id and d.day_n = l.day_span
    )
    and not exists (
      select 1 from public.checkin_deliveries d
      where d.user_id = l.id
        and (d.sent_at at time zone l.tz)::date = l.local_now::date
    );
$$;

revoke all on function public.due_checkins(timestamptz) from public, anon, authenticated;
grant execute on function public.due_checkins(timestamptz) to service_role;

-- Users whose review slot was in the last 48 hours and has not been emailed.
create or replace function public.users_due_for_weekly_review(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  timezone text,
  local_date text,
  week_start text,
  payload jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with zoned as (
    select
      p.id as user_id,
      u.email::text as email,
      coalesce(nullif(p.timezone, ''), 'UTC') as timezone,
      p.review_weekday,
      p.review_hour,
      p.review_minute,
      (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC')) as local_now
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.reviews_opt_out = false
      and u.email is not null
  ),
  slots as (
    select
      z.*,
      z.local_now::date as local_date,
      extract(dow from z.local_now)::int as dow,
      (extract(hour from z.local_now)::int * 60 + extract(minute from z.local_now)::int) as mins,
      (z.review_hour * 60 + z.review_minute) as scheduled
    from zoned z
  ),
  backed as (
    select
      s.*,
      case
        when s.dow = s.review_weekday and s.mins < s.scheduled then 7
        else (s.dow - s.review_weekday + 7) % 7
      end as days_back
    from slots s
  ),
  ready as (
    select
      b.*,
      (b.days_back * 1440 + (b.mins - b.scheduled)) as elapsed,
      (b.local_date - b.days_back) as review_date
    from backed b
  ),
  weeks as (
    select
      r.*,
      (r.review_date - ((extract(dow from r.review_date)::int + 6) % 7))::date as week_start
    from ready r
    where r.elapsed >= 0
      and r.elapsed <= 48 * 60
  )
  select
    w.user_id,
    w.email,
    w.timezone,
    w.local_date::text,
    w.week_start::text,
    wr.payload
  from weeks w
  left join public.weekly_reviews wr
    on wr.user_id = w.user_id
   and wr.week_start = w.week_start
  where wr.emailed_at is null;
$$;

revoke all on function public.users_due_for_weekly_review(timestamptz) from public, anon, authenticated;
grant execute on function public.users_due_for_weekly_review(timestamptz) to service_role;
