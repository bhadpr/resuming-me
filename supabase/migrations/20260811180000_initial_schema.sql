-- Resuming.me Sprint 1: core schema + RLS

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '📌',
  type text not null check (type in ('daily', 'weekly_n', 'deadline')),
  tracking_mode text not null check (tracking_mode in ('timer', 'count', 'checkbox')),
  target_value numeric,
  target_unit text,
  target_effective_from date not null default current_date,
  weekly_target integer,
  deadline date,
  micro_steps jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_deadline_check check (
    (type = 'deadline' and deadline is not null)
    or (type != 'deadline')
  ),
  constraint activities_weekly_target_check check (
    (weekly_target is null or weekly_target > 0)
    and (
      (type = 'weekly_n' and weekly_target is not null)
      or (type != 'weekly_n')
    )
  )
);

create index activities_user_id_idx on public.activities (user_id);
create index activities_user_archived_idx on public.activities (user_id, archived);

alter table public.activities enable row level security;

create policy "Users can view own activities"
  on public.activities for select using (auth.uid() = user_id);

create policy "Users can insert own activities"
  on public.activities for insert with check (auth.uid() = user_id);

create policy "Users can update own activities"
  on public.activities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own activities"
  on public.activities for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- activity_target_history
-- ---------------------------------------------------------------------------
create table public.activity_target_history (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_value numeric,
  target_unit text,
  weekly_target integer,
  effective_from date not null,
  effective_until date,
  created_at timestamptz not null default now(),
  constraint activity_target_history_dates check (
    effective_until is null or effective_until >= effective_from
  )
);

create index activity_target_history_activity_idx
  on public.activity_target_history (activity_id, effective_from desc);

create index activity_target_history_user_idx
  on public.activity_target_history (user_id);

alter table public.activity_target_history enable row level security;

create policy "Users can view own target history"
  on public.activity_target_history for select using (auth.uid() = user_id);

create policy "Users can insert own target history"
  on public.activity_target_history for insert with check (auth.uid() = user_id);

create policy "Users can update own target history"
  on public.activity_target_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own target history"
  on public.activity_target_history for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- metrics
-- ---------------------------------------------------------------------------
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '📊',
  unit text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index metrics_user_id_idx on public.metrics (user_id);

alter table public.metrics enable row level security;

create policy "Users can view own metrics"
  on public.metrics for select using (auth.uid() = user_id);

create policy "Users can insert own metrics"
  on public.metrics for insert with check (auth.uid() = user_id);

create policy "Users can update own metrics"
  on public.metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own metrics"
  on public.metrics for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- metric_entries
-- ---------------------------------------------------------------------------
create table public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metrics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric_id, date)
);

create index metric_entries_user_date_idx on public.metric_entries (user_id, date);

alter table public.metric_entries enable row level security;

create policy "Users can view own metric entries"
  on public.metric_entries for select using (auth.uid() = user_id);

create policy "Users can insert own metric entries"
  on public.metric_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own metric entries"
  on public.metric_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own metric entries"
  on public.metric_entries for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- log_entries
-- ---------------------------------------------------------------------------
create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('session', 'postponed', 'completed')),
  source text check (source in ('timer', 'manual')),
  started_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index log_entries_user_date_idx on public.log_entries (user_id, date);
create index log_entries_activity_date_idx on public.log_entries (activity_id, date);

-- Idempotency: at most one postponed entry per activity per day
create unique index log_entries_postponed_unique
  on public.log_entries (activity_id, date)
  where type = 'postponed';

alter table public.log_entries enable row level security;

create policy "Users can view own log entries"
  on public.log_entries for select using (auth.uid() = user_id);

create policy "Users can insert own log entries"
  on public.log_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own log entries"
  on public.log_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own log entries"
  on public.log_entries for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create trigger metrics_set_updated_at
  before update on public.metrics
  for each row execute function public.set_updated_at();

create trigger metric_entries_set_updated_at
  before update on public.metric_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auto-create profile on sign-up (timezone from OAuth metadata when available)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
