-- Recurring once-a-month activities (bills, subscriptions).

alter table public.activities drop constraint if exists activities_type_check;

alter table public.activities
  add constraint activities_type_check
  check (type in ('daily', 'weekly_n', 'deadline', 'monthly'));
