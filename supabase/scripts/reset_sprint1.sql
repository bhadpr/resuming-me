-- Run this in Supabase SQL Editor ONLY if a previous migration attempt partially succeeded.
-- Safe when profiles exists but later tables are missing.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop trigger if exists metric_entries_set_updated_at on public.metric_entries;
drop trigger if exists metrics_set_updated_at on public.metrics;
drop trigger if exists activities_set_updated_at on public.activities;
drop trigger if exists profiles_set_updated_at on public.profiles;
drop function if exists public.set_updated_at();

drop table if exists public.log_entries cascade;
drop table if exists public.metric_entries cascade;
drop table if exists public.metrics cascade;
drop table if exists public.activity_target_history cascade;
drop table if exists public.activities cascade;
drop table if exists public.profiles cascade;

-- After this completes, re-run:
-- supabase/migrations/20260811180000_initial_schema.sql
