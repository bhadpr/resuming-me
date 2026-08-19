-- Add per-account activity and number (metric) counts to the admin sign-in list.
-- CREATE OR REPLACE cannot change RETURNS TABLE, so drop first.

drop function if exists public.list_signed_in_emails();

create function public.list_signed_in_emails()
returns table (
  email text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  activity_count bigint,
  metric_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.email,
    u.last_sign_in_at,
    u.created_at,
    (
      select count(*)::bigint
      from public.activities a
      where a.user_id = u.id
    ) as activity_count,
    (
      select count(*)::bigint
      from public.metrics m
      where m.user_id = u.id
    ) as metric_count
  from auth.users u
  where public.is_current_user_admin()
    and u.email is not null
    and u.email <> ''
    and exists (
      select 1
      from auth.identities i
      where i.user_id = u.id
        and i.provider = 'google'
    )
  order by u.last_sign_in_at desc nulls last, u.created_at desc;
$$;

comment on function public.list_signed_in_emails() is
  'Returns Google account emails plus activity and number counts. Empty unless the caller is an admin.';

revoke all on function public.list_signed_in_emails() from public;
grant execute on function public.list_signed_in_emails() to authenticated;
