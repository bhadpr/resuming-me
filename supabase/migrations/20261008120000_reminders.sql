-- Reminders: one thing to do on one day, with an optional time.
-- Not a habit: no streaks, no history beyond the done time.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  day date not null,
  hour smallint,
  minute smallint,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_text_len check (char_length(btrim(text)) between 1 and 120),
  constraint reminders_hour check (hour between 0 and 23),
  constraint reminders_minute check (minute between 0 and 59),
  constraint reminders_time_pair check ((hour is null) = (minute is null))
);

create index reminders_user_day_idx on public.reminders (user_id, day);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- At most 100 open reminders per person, so the list stays a list.
create or replace function public.reminders_enforce_open_cap()
returns trigger
language plpgsql
as $$
begin
  if new.done_at is null and (
    select count(*) from public.reminders
    where user_id = new.user_id and done_at is null
  ) >= 100 then
    raise exception 'reminders_open_cap' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger reminders_open_cap
  before insert on public.reminders
  for each row execute function public.reminders_enforce_open_cap();

alter table public.reminders enable row level security;

create policy "Users can view own reminders"
  on public.reminders for select using (auth.uid() = user_id);

create policy "Users can insert own reminders"
  on public.reminders for insert with check (auth.uid() = user_id);

create policy "Users can update own reminders"
  on public.reminders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own reminders"
  on public.reminders for delete using (auth.uid() = user_id);
