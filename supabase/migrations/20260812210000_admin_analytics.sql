-- Admin role + first-party page analytics

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Site operator. Grant via SQL only; clients cannot self-promote.';

-- Prevent signed-in users from elevating themselves via profile update.
create or replace function public.profiles_preserve_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and auth.uid() = new.id
     and new.is_admin is distinct from old.is_admin then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_preserve_is_admin on public.profiles;
create trigger profiles_preserve_is_admin
  before update on public.profiles
  for each row
  execute function public.profiles_preserve_is_admin();

-- Promote founding admin (no-op until this email has signed in once).
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('bhadpr@gmail.com');

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  title text,
  visitor_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint page_views_path_len check (char_length(path) between 1 and 500),
  constraint page_views_title_len check (title is null or char_length(title) <= 200),
  constraint page_views_visitor_len check (char_length(visitor_id) between 8 and 80),
  constraint page_views_referrer_len check (referrer is null or char_length(referrer) <= 1000),
  constraint page_views_ua_len check (user_agent is null or char_length(user_agent) <= 500)
);

create index if not exists page_views_created_at_idx
  on public.page_views (created_at desc);

create index if not exists page_views_path_created_idx
  on public.page_views (path, created_at desc);

create index if not exists page_views_visitor_created_idx
  on public.page_views (visitor_id, created_at desc);

alter table public.page_views enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

drop policy if exists "Anyone can record page views" on public.page_views;
create policy "Anyone can record page views"
  on public.page_views for insert
  to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

drop policy if exists "Admins can read page views" on public.page_views;
create policy "Admins can read page views"
  on public.page_views for select
  to authenticated
  using (public.is_current_user_admin());

grant select, insert on table public.page_views to authenticated;
grant insert on table public.page_views to anon;
