-- ZIP codes for the school area. Empty keeps the list off School calendar.
-- The share link still opens it.

alter table public.shared_lists
  add column if not exists zip_codes text[] not null default '{}';

alter table public.shared_lists
  drop constraint if exists shared_lists_zip_codes;

alter table public.shared_lists
  add constraint shared_lists_zip_codes check (
    cardinality(zip_codes) <= 40
    and zip_codes::text ~ '^\{([0-9]{5}(,[0-9]{5})*)?\}$'
  );
