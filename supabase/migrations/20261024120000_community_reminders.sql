-- Community reminders: days many people keep, such as Diwali or Christmas. Only the admin makes them.
-- Anyone can read the ones still ahead. A person who picks one gets an ordinary reminder of their own,
-- so it can be edited, done, or deleted like any other, and it works offline.
-- The admin enters each year's date by hand. A day that has passed stops showing, for everyone.

create table public.community_reminders (
  id uuid primary key default gen_random_uuid(),
  -- {"en": "Diwali", "hi": "..."}. English is required; a missing language falls back to English.
  titles jsonb not null,
  day date not null,
  -- Also alert on the evening before, for preparing.
  remind_before boolean not null default true,
  kind text not null default 'event',
  -- community-photos/<id>/<random>.jpg
  photo_path text,
  active boolean not null default true,
  -- Lower shows first among the same day.
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reminders_titles check (
    jsonb_typeof(titles) = 'object'
    and char_length(btrim(coalesce(titles ->> 'en', ''))) between 1 and 120
  ),
  constraint community_reminders_kind check (kind in ('errand', 'bill', 'doctor', 'event', 'other')),
  constraint community_reminders_photo_path check (
    photo_path is null or photo_path ~ ('^' || id::text || '/[a-z0-9-]{8,64}\.jpg$')
  )
);

create index community_reminders_day_idx on public.community_reminders (day, sort_order);

create trigger community_reminders_set_updated_at
  before update on public.community_reminders
  for each row execute function public.set_updated_at();

alter table public.community_reminders enable row level security;

-- Today's local date can be a day behind UTC, so one extra day stays readable.
create policy "Anyone can read upcoming community reminders"
  on public.community_reminders for select to anon, authenticated
  using (active and day >= current_date - 1);

create policy "Admins can read all community reminders"
  on public.community_reminders for select to authenticated
  using (coalesce(public.is_current_user_admin(), false));

create policy "Admins can create community reminders"
  on public.community_reminders for insert to authenticated
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can update community reminders"
  on public.community_reminders for update to authenticated
  using (coalesce(public.is_current_user_admin(), false))
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can delete community reminders"
  on public.community_reminders for delete to authenticated
  using (coalesce(public.is_current_user_admin(), false));

-- The picture for each one. Public, like the shared event photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-photos', 'community-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload community photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-photos'
    and coalesce(public.is_current_user_admin(), false)
  );

create policy "Admins delete community photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-photos'
    and coalesce(public.is_current_user_admin(), false)
  );

-- A copy remembers which one it came from, so the list can show it as added, and keeps its picture.
-- There is no link to the table: removing a community reminder leaves every copy as it is.
alter table public.reminders
  add column community_id uuid,
  add column community_photo_path text,
  add constraint reminders_community_photo_path check (
    community_photo_path is null
    or community_photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9-]{8,64}\.jpg$'
  );
