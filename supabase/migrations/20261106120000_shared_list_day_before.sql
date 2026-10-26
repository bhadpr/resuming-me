-- The list can ask for an alert the evening before each day.
-- Someone accepting the link can still turn that off.

alter table public.shared_lists
  add column remind_before boolean not null default false;
