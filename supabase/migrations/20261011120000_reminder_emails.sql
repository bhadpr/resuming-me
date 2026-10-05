-- Morning email on a day with open reminders, for people who choose it in Settings.
-- Off by default. Sent by send-check-ins, at most once a local day, between 07:00 and 12:00.
-- The email's opt-out link is the check-in one, and it turns this off too.

alter table public.profiles
  add column if not exists reminder_emails boolean not null default false;

create table if not exists public.reminder_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, sent_on)
);

alter table public.reminder_emails enable row level security;

create or replace function public.due_reminder_emails(p_now timestamptz default now())
returns table (
  user_id uuid,
  email text,
  locale text,
  local_date date,
  checkin_token uuid,
  items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with local as (
    select
      p.id,
      u.email::text as email,
      coalesce(nullif(p.locale, ''), 'en') as locale,
      p.checkin_token,
      (p_now at time zone coalesce(nullif(p.timezone, ''), 'UTC')) as local_now
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.reminder_emails = true
      and u.email is not null
  ),
  today as (
    select
      l.*,
      l.local_now::date as local_date,
      extract(hour from l.local_now)::int as local_hour
    from local l
  )
  select
    t.id,
    t.email,
    t.locale,
    t.local_date,
    t.checkin_token,
    (
      select jsonb_agg(
        jsonb_build_object('text', r.text, 'hour', r.hour, 'minute', r.minute)
        order by r.hour nulls last, r.minute, r.created_at
      )
      from public.reminders r
      where r.user_id = t.id
        and r.done_at is null
        and r.day = t.local_date
    ) as items
  from today t
  where t.local_hour >= 7
    and t.local_hour < 12
    and exists (
      select 1 from public.reminders r
      where r.user_id = t.id
        and r.done_at is null
        and r.day = t.local_date
    )
    and not exists (
      select 1 from public.reminder_emails e
      where e.user_id = t.id
        and e.sent_on = t.local_date
    );
$$;

revoke all on function public.due_reminder_emails(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminder_emails(timestamptz) to service_role;

comment on function public.due_reminder_emails(timestamptz) is
  'Morning reminder email for people who turned it on. Call from send-check-ins each hour.';

-- One link turns off every email from Resuming, reminder emails included.
create or replace function public.opt_out_checkins(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update public.profiles
  set checkins_opt_out = true, reminder_emails = false, updated_at = now()
  where checkin_token = p_token;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.opt_out_checkins(uuid) from public;
grant execute on function public.opt_out_checkins(uuid) to anon, authenticated;
