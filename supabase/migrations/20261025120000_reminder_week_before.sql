-- An alert a week before, besides the one the evening before. A reminder can have either, both, or neither.
-- The app arms these alerts on the phone, like the evening-before one, so no query changes.
-- Community reminders carry the choice, so picking one gives the person's reminder the same alerts.

alter table public.reminders
  add column remind_week_before boolean not null default false;

alter table public.community_reminders
  add column remind_week_before boolean not null default false;
