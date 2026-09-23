-- Weekly review email only after onboarding is finished.

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
      and p.onboarding_completed_at is not null
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
