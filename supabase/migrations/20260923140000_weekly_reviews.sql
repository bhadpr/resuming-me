-- Weekly review cache, optional birthday, and the review schedule.

alter table public.profiles
  add column if not exists birthday date,
  add column if not exists focus_activity_id uuid references public.activities (id) on delete set null,
  add column if not exists focus_week_start date,
  add column if not exists review_weekday smallint not null default 0,
  add column if not exists review_hour smallint not null default 18,
  add column if not exists review_minute smallint not null default 0,
  add column if not exists reviews_opt_out boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_review_weekday_check,
  drop constraint if exists profiles_review_hour_check,
  drop constraint if exists profiles_review_minute_check;

alter table public.profiles
  add constraint profiles_review_weekday_check check (review_weekday between 0 and 6),
  add constraint profiles_review_hour_check check (review_hour between 0 and 23),
  add constraint profiles_review_minute_check check (review_minute between 0 and 59);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  payload jsonb not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;

create policy "Users can view own weekly reviews"
  on public.weekly_reviews for select using (auth.uid() = user_id);

create policy "Users can insert own weekly reviews"
  on public.weekly_reviews for insert with check (auth.uid() = user_id);

create policy "Users can update own weekly reviews"
  on public.weekly_reviews for update using (auth.uid() = user_id);

create or replace function public.due_weekly_reviews()
returns table (
  user_id uuid,
  email text,
  timezone text,
  week_start date,
  payload jsonb
)
language sql
security definer
set search_path = public
as $$
  select r.user_id, u.email::text, coalesce(p.timezone, 'UTC'), r.week_start, r.payload
  from public.weekly_reviews r
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.emailed_at is null
    and p.reviews_opt_out = false
    and u.email is not null;
$$;

revoke all on function public.due_weekly_reviews() from public, anon, authenticated;
grant execute on function public.due_weekly_reviews() to service_role;
