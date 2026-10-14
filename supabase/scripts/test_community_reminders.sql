-- Checks for community reminders. Run them inside one transaction that is rolled back, with the
-- migration first so it is tested too:
--
--   begin;
--   <supabase/migrations/20261024120000_community_reminders.sql>
--   <this file>
--   rollback;
--
-- Each check raises with its name when it fails, and the script ends with 'ok'.

do $$
declare
  admin_id uuid := 'da999a92-229d-4376-8918-aec77ffef445';
  seen int;
  fid uuid := '00000000-0000-0000-0000-00000000c0a1';
  pid uuid := '00000000-0000-0000-0000-00000000c0a2';
  oid uuid := '00000000-0000-0000-0000-00000000c0a3';
begin
  -- Three rows made directly (this session ignores row level security): ahead, passed, switched off.
  insert into public.community_reminders (id, titles, day, active) values
    (fid, '{"en": "CT Future"}', current_date + 10, true),
    (pid, '{"en": "CT Past"}', current_date - 5, true),
    (oid, '{"en": "CT Off"}', current_date + 10, false);

  -- A title needs English.
  begin
    insert into public.community_reminders (titles, day) values ('{"hi": "x"}', current_date);
    raise exception 'check titles: a title with no English was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.community_reminders (titles, day) values ('["en"]', current_date);
    raise exception 'check titles: a list was accepted as titles';
  exception when check_violation then null;
  end;

  -- A picture path must sit in the row's own folder.
  begin
    insert into public.community_reminders (titles, day, photo_path)
    values ('{"en": "CT Bad photo"}', current_date, '../other.jpg');
    raise exception 'check photo: a path outside the folder was accepted';
  exception when check_violation then null;
  end;
  update public.community_reminders
    set photo_path = fid::text || '/1f2e3d4c-5b6a-4789-8abc-def012345678.jpg'
    where id = fid;

  -- Someone who is not signed in sees only the one that is ahead and on.
  set local role anon;
  select count(*) into seen from public.community_reminders where titles ->> 'en' like 'CT %';
  reset role;
  if seen <> 1 then raise exception 'check anon read: expected 1 row, saw %', seen; end if;

  -- A signed-in person who is not the admin sees the same, and cannot write.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
  set local role authenticated;
  select count(*) into seen from public.community_reminders where titles ->> 'en' like 'CT %';
  if seen <> 1 then raise exception 'check member read: expected 1 row, saw %', seen; end if;
  begin
    insert into public.community_reminders (titles, day) values ('{"en": "CT Mine"}', current_date + 1);
    raise exception 'check member write: an insert by a member was accepted';
  exception when insufficient_privilege then null;
  end;
  update public.community_reminders set active = false where id = fid;
  get diagnostics seen = row_count;
  if seen <> 0 then raise exception 'check member write: an update by a member changed % rows', seen; end if;
  delete from public.community_reminders where id = fid;
  get diagnostics seen = row_count;
  if seen <> 0 then raise exception 'check member write: a delete by a member removed % rows', seen; end if;
  reset role;

  -- The admin sees all three, and can write.
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  select count(*) into seen from public.community_reminders where titles ->> 'en' like 'CT %';
  if seen <> 3 then raise exception 'check admin read: expected 3 rows, saw %', seen; end if;
  insert into public.community_reminders (titles, day) values ('{"en": "CT Admin made"}', current_date + 2);
  update public.community_reminders set sort_order = 3 where id = fid;
  get diagnostics seen = row_count;
  if seen <> 1 then raise exception 'check admin write: expected to update 1 row, updated %', seen; end if;
  delete from public.community_reminders where id = pid;
  get diagnostics seen = row_count;
  if seen <> 1 then raise exception 'check admin write: expected to delete 1 row, deleted %', seen; end if;
  reset role;

  -- A reminder keeps where it came from and its picture, and a bad picture path is refused.
  insert into public.reminders (user_id, text, day, community_id, community_photo_path)
  values (admin_id, 'CT copy', current_date + 10, fid, fid::text || '/1f2e3d4c-5b6a-4789-8abc-def012345678.jpg');
  begin
    insert into public.reminders (user_id, text, day, community_photo_path)
    values (admin_id, 'CT bad copy', current_date + 10, '../x.jpg');
    raise exception 'check copy: a bad picture path was accepted';
  exception when check_violation then null;
  end;

  -- Removing the community reminder leaves the copy alone.
  delete from public.community_reminders where id = fid;
  select count(*) into seen from public.reminders where text = 'CT copy' and community_id = fid;
  if seen <> 1 then raise exception 'check copy: the copy changed when its community reminder was deleted'; end if;
end
$$;

select 'ok' as community_reminders;
