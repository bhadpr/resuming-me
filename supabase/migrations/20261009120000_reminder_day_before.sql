-- Optional evening alert on the day before a reminder.

alter table public.reminders
  add column remind_before boolean not null default false;
