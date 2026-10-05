-- Each reminder can say before food, after food, or with food.
alter table public.medicine_times
  add column if not exists meal text;

alter table public.medicine_times
  drop constraint if exists medicine_times_meal;

alter table public.medicine_times
  add constraint medicine_times_meal check (meal is null or meal in ('before', 'after', 'with'));
