-- Sprint 7: schedule timezone-aware rollover Edge Function via pg_cron.
--
-- Prerequisites:
-- 1. Deploy the function:
--      supabase functions deploy rollover
-- 2. Replace PROJECT_REF and set the service role key in Vault (recommended)
--    or paste carefully below for a personal project.
--
-- This migration enables extensions and creates a helper. The actual cron
-- schedule is created only after you set app settings (avoids committing secrets).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Store Edge Function URL (no secret). Update after deploy.
-- Example: https://toeemvcvizpfcyknogph.supabase.co/functions/v1/rollover
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- No policies for authenticated users — service role / SQL editor only.

comment on table public.app_settings is
  'Internal config (e.g. rollover_function_url). Not client-readable.';

-- Manual invoke helper (call from SQL editor after setting URL + Authorization header via Vault).
-- Prefer Supabase Dashboard → Edge Functions → Schedules if available on your plan.
--
-- After deploy, run something like:
--
--   insert into public.app_settings (key, value) values
--     ('rollover_function_url', 'https://YOUR_REF.supabase.co/functions/v1/rollover')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
--   select cron.schedule(
--     'resuming-rollover-hourly',
--     '5 * * * *',  -- minute 5 every hour
--     $$
--     select net.http_post(
--       url := (select value from public.app_settings where key = 'rollover_function_url'),
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
--       ),
--       body := '{}'::jsonb
--     );
--     $$
--   );
--
-- Until cron is wired, the web app runs an idempotent client catch-up on open
-- (src/lib/rolloverClient.ts) so postponements still appear for personal use.
