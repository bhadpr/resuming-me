-- Holiday and sports lists need more open reminder slots than the old 200.

create or replace function public.reminders_enforce_open_cap()
returns trigger
language plpgsql
as $$
begin
  if new.done_at is null and (
    select count(*) from public.reminders
    where user_id = new.user_id and done_at is null
  ) >= 1000 then
    raise exception 'reminders_open_cap' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
