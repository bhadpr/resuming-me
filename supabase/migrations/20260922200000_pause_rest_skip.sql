-- P1-04: pause / rest day / explicit skip (stop treating auto put-offs as skips)

-- Allow source = 'auto' for historical backfilled postponed rows
alter table public.log_entries
  drop constraint if exists log_entries_source_check;

alter table public.log_entries
  add constraint log_entries_source_check
  check (source is null or source in ('timer', 'manual', 'auto'));

-- Existing postponed rows were auto-created before user Skip existed
update public.log_entries
set source = 'auto'
where type = 'postponed' and source is null;

-- ---------------------------------------------------------------------------
-- activity_pauses
-- ---------------------------------------------------------------------------
create table public.activity_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  paused_from date not null,
  paused_until date,
  created_at timestamptz not null default now(),
  constraint activity_pauses_range_ok check (
    paused_until is null or paused_until >= paused_from
  )
);

create index activity_pauses_user_idx on public.activity_pauses (user_id);
create index activity_pauses_activity_idx on public.activity_pauses (activity_id);

alter table public.activity_pauses enable row level security;

create policy "Users can view own activity pauses"
  on public.activity_pauses for select using (auth.uid() = user_id);

create policy "Users can insert own activity pauses"
  on public.activity_pauses for insert with check (auth.uid() = user_id);

create policy "Users can update own activity pauses"
  on public.activity_pauses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own activity pauses"
  on public.activity_pauses for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.activity_pauses to authenticated;

-- ---------------------------------------------------------------------------
-- rest_days
-- ---------------------------------------------------------------------------
create table public.rest_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index rest_days_user_date_idx on public.rest_days (user_id, date);

alter table public.rest_days enable row level security;

create policy "Users can view own rest days"
  on public.rest_days for select using (auth.uid() = user_id);

create policy "Users can insert own rest days"
  on public.rest_days for insert with check (auth.uid() = user_id);

create policy "Users can update own rest days"
  on public.rest_days for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own rest days"
  on public.rest_days for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.rest_days to authenticated;
