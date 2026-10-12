-- A private photo on any reminder, stored at reminder-photos/<user id>/<name>.jpg.
-- Only its owner reads it. Sharing the reminder copies it into the public event-photos bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reminder-photos', 'reminder-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.reminders
  add column photo_path text,
  add constraint reminders_photo_path check (
    photo_path is null or photo_path ~ ('^' || user_id::text || '/[a-z0-9-]{8,80}\.jpg$')
  );

create policy "Users read own reminder photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'reminder-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload own reminder photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reminder-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own reminder photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reminder-photos' and (storage.foldername(name))[1] = auth.uid()::text);
