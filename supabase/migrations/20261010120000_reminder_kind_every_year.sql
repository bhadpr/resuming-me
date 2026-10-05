-- A kind for the icon, and birthdays or festivals that come back each year.

alter table public.reminders
  add column kind text not null default 'other',
  add column every_year boolean not null default false,
  add constraint reminders_kind check (kind in ('errand', 'bill', 'doctor', 'event', 'other'));
