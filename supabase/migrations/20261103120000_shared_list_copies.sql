-- A person's copy of a shared-list item remembers which item it came from,
-- so accepting the same one again does not make a second reminder.
-- No link to the item: switching the list off leaves every copy as it is.

alter table public.reminders
  add column shared_list_item_id uuid;

create unique index reminders_one_shared_list_item
  on public.reminders (user_id, shared_list_item_id)
  where shared_list_item_id is not null;
