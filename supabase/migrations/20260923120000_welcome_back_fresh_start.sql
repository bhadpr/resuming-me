-- Phase 3: welcome-back once per gap, and reversible fresh starts.

alter table public.profiles
  add column if not exists last_welcome_back_shown_at timestamptz,
  add column if not exists last_gap_started_at date,
  add column if not exists welcome_back_dismissed_until timestamptz;

create table if not exists public.fresh_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_on date not null,
  covers_from date not null,
  covers_to date not null,
  created_at timestamptz not null default now(),
  check (covers_from <= covers_to)
);

create index if not exists fresh_starts_user_started_idx
  on public.fresh_starts (user_id, started_on desc);

alter table public.fresh_starts enable row level security;

create policy "Users can view own fresh starts"
  on public.fresh_starts for select using (auth.uid() = user_id);

create policy "Users can insert own fresh starts"
  on public.fresh_starts for insert with check (auth.uid() = user_id);

create policy "Users can delete own fresh starts"
  on public.fresh_starts for delete using (auth.uid() = user_id);
