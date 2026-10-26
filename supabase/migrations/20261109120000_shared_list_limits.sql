-- A large city district needs more than 40 ZIP codes.
-- A school year that lists each weekday of a break needs more than 20 days.
-- A shared link uses the same day cap.

alter table public.shared_lists
  drop constraint if exists shared_lists_zip_codes;

alter table public.shared_lists
  add constraint shared_lists_zip_codes check (
    cardinality(zip_codes) <= 300
    and zip_codes::text ~ '^\{([0-9]{5}(,[0-9]{5})*)?\}$'
  );

create or replace function public.shared_list_items_cap()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.shared_list_items where list_id = new.list_id
  ) >= 40 then
    raise exception 'shared_list_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
