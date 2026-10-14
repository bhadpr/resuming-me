-- Repeating reminders: one reminder that comes back every day or every week until an end date.
-- The row keeps the next day it is due in `day`. Missed days are not stored or caught up.
-- Done moves `day` forward, and after the last one sets done_at as before.

alter table public.reminders
  add column if not exists repeat_every text,
  add column if not exists repeat_until date,
  add column if not exists repeat_from date,
  add column if not exists last_done_on date;

alter table public.reminders
  add constraint reminders_repeat_kind check (repeat_every is null or repeat_every in ('day', 'week')),
  add constraint reminders_repeat_set check (
    (repeat_every is null and repeat_until is null and repeat_from is null)
    or (repeat_every is not null and repeat_until is not null and repeat_from is not null)
  ),
  -- At most two months from the first day, and not before it.
  add constraint reminders_repeat_window check (
    repeat_every is null
    or (repeat_until >= repeat_from and repeat_until <= (repeat_from + interval '2 months')::date)
  ),
  -- A repeat is not an every-year reminder and is never shared.
  add constraint reminders_repeat_alone check (
    repeat_every is null or (not every_year and shared_event_id is null)
  );

comment on column public.reminders.repeat_every is 'day or week. Null for a one-time reminder.';
comment on column public.reminders.repeat_until is 'Last day a repeating reminder comes back.';
comment on column public.reminders.repeat_from is 'First day of the repeat. The two-month limit counts from here.';
comment on column public.reminders.last_done_on is 'Local day a repeating reminder was last marked done.';

-- Whether a reminder falls on a day. A repeat is due on its stored day and every step after it,
-- up to its end date. The stored day can be older than today, because missed days are not caught up.
create or replace function public.reminder_due_on(
  p_day date,
  p_repeat text,
  p_until date,
  p_on date
)
returns boolean
language sql
immutable
as $$
  select case
    when p_repeat is null then p_day = p_on
    else p_on >= p_day
      and p_on <= p_until
      and (p_repeat = 'day' or (p_on - p_day) % 7 = 0)
  end;
$$;

-- The morning email also lists repeating reminders that are due today.
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
        and public.reminder_due_on(r.day, r.repeat_every, r.repeat_until, t.local_date)
    ) as items
  from today t
  where t.local_hour >= 7
    and t.local_hour < 12
    and exists (
      select 1 from public.reminders r
      where r.user_id = t.id
        and r.done_at is null
        and public.reminder_due_on(r.day, r.repeat_every, r.repeat_until, t.local_date)
    )
    and not exists (
      select 1 from public.reminder_emails e
      where e.user_id = t.id
        and e.sent_on = t.local_date
    );
$$;

revoke all on function public.due_reminder_emails(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminder_emails(timestamptz) to service_role;
