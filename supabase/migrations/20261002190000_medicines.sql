-- Medicines: a bottle, the days and times it is taken, and a taken log.
-- Photos live in the private medicine-photos bucket, one file per medicine.

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  photo_path text,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medicines_name_len check (char_length(btrim(name)) between 1 and 40),
  constraint medicines_weekdays_ok check (
    weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
    and cardinality(weekdays) >= 1
  )
);

create index medicines_user_idx on public.medicines (user_id, archived);

create trigger medicines_set_updated_at
  before update on public.medicines
  for each row execute function public.set_updated_at();

alter table public.medicines enable row level security;

create policy "Users can view own medicines"
  on public.medicines for select using (auth.uid() = user_id);

create policy "Users can insert own medicines"
  on public.medicines for insert with check (auth.uid() = user_id);

create policy "Users can update own medicines"
  on public.medicines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own medicines"
  on public.medicines for delete using (auth.uid() = user_id);

create table public.medicine_times (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hour smallint not null,
  minute smallint not null,
  created_at timestamptz not null default now(),
  constraint medicine_times_hour check (hour between 0 and 23),
  constraint medicine_times_minute check (minute between 0 and 59),
  unique (medicine_id, hour, minute)
);

create index medicine_times_user_idx on public.medicine_times (user_id);

alter table public.medicine_times enable row level security;

create policy "Users can view own medicine times"
  on public.medicine_times for select using (auth.uid() = user_id);

create policy "Users can insert own medicine times"
  on public.medicine_times for insert with check (auth.uid() = user_id);

create policy "Users can delete own medicine times"
  on public.medicine_times for delete using (auth.uid() = user_id);

create table public.medicine_doses (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  hour smallint not null,
  minute smallint not null,
  taken_at timestamptz not null default now(),
  constraint medicine_doses_hour check (hour between 0 and 23),
  constraint medicine_doses_minute check (minute between 0 and 59),
  unique (medicine_id, date, hour, minute)
);

create index medicine_doses_user_date_idx on public.medicine_doses (user_id, date);

alter table public.medicine_doses enable row level security;

create policy "Users can view own medicine doses"
  on public.medicine_doses for select using (auth.uid() = user_id);

create policy "Users can insert own medicine doses"
  on public.medicine_doses for insert with check (auth.uid() = user_id);

create policy "Users can delete own medicine doses"
  on public.medicine_doses for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('medicine-photos', 'medicine-photos', false)
on conflict (id) do nothing;

create policy "Users read own medicine photos"
  on storage.objects for select
  using (
    bucket_id = 'medicine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload own medicine photos"
  on storage.objects for insert
  with check (
    bucket_id = 'medicine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own medicine photos"
  on storage.objects for update
  using (
    bucket_id = 'medicine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own medicine photos"
  on storage.objects for delete
  using (
    bucket_id = 'medicine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
