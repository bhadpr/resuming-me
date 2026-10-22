-- One picture for a whole reminder list, such as a school logo.
-- Stored at list-photos/<list id>/<random>.jpg. Anyone with the link can see it.
-- A list holds at most 20 reminders.

alter table public.shared_lists
  add column photo_path text,
  add constraint shared_lists_photo_path check (
    photo_path is null or photo_path ~ ('^' || id::text || '/[a-z0-9-]{8,64}\.jpg$')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('list-photos', 'list-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload shared list photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'list-photos'
    and coalesce(public.is_current_user_admin(), false)
    and exists (
      select 1 from public.shared_lists
      where id::text = (storage.foldername(name))[1]
    )
  );

create policy "Admins delete shared list photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'list-photos'
    and coalesce(public.is_current_user_admin(), false)
  );

create or replace function public.shared_list_items_cap()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.shared_list_items where list_id = new.list_id
  ) >= 20 then
    raise exception 'shared_list_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger shared_list_items_cap
  before insert on public.shared_list_items
  for each row execute function public.shared_list_items_cap();
