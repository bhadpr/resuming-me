-- Data retention (P15-15).
--
-- 1. erase_user_usage(): called by the delete-account function. Removes the usage events of a
--    deleted account (including the events the same device sent before sign-in), and takes the
--    person's email off any referral seat so the account leaves nothing readable behind.
-- 2. enforce_data_retention(): runs every day. Usage events and page views are deleted after 13
--    months. Install records keep their counts, but the hashed device id is replaced with a random
--    value after 13 months, so old rows can no longer be tied to a phone.
--
-- Install records are not linked to an account (only a hashed device id and the referral group),
-- so account deletion cannot find them. The 13-month rule is what removes the device id.

alter table public.marketing_installs
  add column if not exists anonymized_at timestamptz;

create or replace function public.erase_user_usage(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;

  delete from public.events
  where user_id = p_user
     or anon_id in (
       select distinct anon_id from public.events where user_id = p_user
     );

  -- The seat stays so counts and payments are kept, but it no longer holds a person's email
  -- and its link stops earning installs.
  update public.marketing_members
  set email = '(deleted account)',
      removed_at = coalesce(removed_at, now())
  where user_id = p_user;
end;
$$;

revoke all on function public.erase_user_usage(uuid) from public, anon, authenticated;
grant execute on function public.erase_user_usage(uuid) to service_role;

create or replace function public.enforce_data_retention()
returns table (events_deleted bigint, page_views_deleted bigint, installs_anonymized bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff constant timestamptz := now() - interval '13 months';
  v_events bigint;
  v_views bigint;
  v_installs bigint;
begin
  delete from public.events where created_at < v_cutoff;
  get diagnostics v_events = row_count;

  delete from public.page_views where created_at < v_cutoff;
  get diagnostics v_views = row_count;

  update public.marketing_installs
  set device_key = encode(
        sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')),
        'hex'
      ),
      anonymized_at = now()
  where anonymized_at is null
    and created_at < v_cutoff;
  get diagnostics v_installs = row_count;

  return query select v_events, v_views, v_installs;
end;
$$;

revoke all on function public.enforce_data_retention() from public, anon, authenticated;
grant execute on function public.enforce_data_retention() to service_role;

-- Every day at 03:30 UTC. Scheduling by name again replaces the earlier schedule.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'resuming-data-retention',
      '30 3 * * *',
      'select public.enforce_data_retention()'
    );
  end if;
end;
$$;
