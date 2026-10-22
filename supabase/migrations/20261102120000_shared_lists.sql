-- One link that holds many reminders. Only an admin creates or changes a list.
-- Anyone can read a list that is still on. Accepting a copy comes in a later sprint.

create table public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.shared_event_new_code(),
  title text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_lists_title check (
    char_length(btrim(title)) between 1 and 80
    and not public.has_web_link(title)
  ),
  constraint shared_lists_status check (status in ('active', 'off')),
  constraint shared_lists_code check (code ~ '^[a-z0-9]{6}$')
);

create trigger shared_lists_set_updated_at
  before update on public.shared_lists
  for each row execute function public.set_updated_at();

create table public.shared_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  text text not null,
  day date not null,
  hour smallint,
  minute smallint,
  sort_order smallint not null default 0,
  constraint shared_list_items_text check (
    char_length(btrim(text)) between 1 and 120
    and not public.has_web_link(text)
  ),
  constraint shared_list_items_time check (
    (hour is null and minute is null)
    or (hour between 0 and 23 and minute between 0 and 59)
  )
);

create index shared_list_items_list_idx on public.shared_list_items (list_id, sort_order);

alter table public.shared_lists enable row level security;
alter table public.shared_list_items enable row level security;

create policy "Anyone can read an active shared list"
  on public.shared_lists for select to anon, authenticated
  using (status = 'active');

create policy "Admins can read every shared list"
  on public.shared_lists for select to authenticated
  using (coalesce(public.is_current_user_admin(), false));

create policy "Admins can create shared lists"
  on public.shared_lists for insert to authenticated
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can update shared lists"
  on public.shared_lists for update to authenticated
  using (coalesce(public.is_current_user_admin(), false))
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can delete shared lists"
  on public.shared_lists for delete to authenticated
  using (coalesce(public.is_current_user_admin(), false));

create policy "Anyone can read items on an active shared list"
  on public.shared_list_items for select to anon, authenticated
  using (
    exists (
      select 1 from public.shared_lists
      where shared_lists.id = list_id and shared_lists.status = 'active'
    )
    or coalesce(public.is_current_user_admin(), false)
  );

create policy "Admins can add shared list items"
  on public.shared_list_items for insert to authenticated
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can update shared list items"
  on public.shared_list_items for update to authenticated
  using (coalesce(public.is_current_user_admin(), false))
  with check (coalesce(public.is_current_user_admin(), false));

create policy "Admins can delete shared list items"
  on public.shared_list_items for delete to authenticated
  using (coalesce(public.is_current_user_admin(), false));
