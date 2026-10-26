-- A copied school day remembers which calendar it still follows.
-- The next time Reminders opens, a changed day on that calendar updates the copy.
-- Cleared when the person edits the name, date, or time. No foreign key:
-- deleting the calendar leaves the copy as it is.

alter table public.reminders
  add column if not exists shared_list_id uuid;
