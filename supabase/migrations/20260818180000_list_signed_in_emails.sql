-- Admin-only list of Google emails that have signed in.
-- Emails live in auth.users, which the client cannot read directly.
-- Counts are added in 20260818190000_signed_in_account_counts.sql.

create or replace function public.list_signed_in_emails()
returns table (
  email text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.email,
    u.last_sign_in_at,
    u.created_at
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
  'Returns Google account emails for signed-in users. Empty unless the caller is an admin.';

revoke all on function public.list_signed_in_emails() from public;
grant execute on function public.list_signed_in_emails() to authenticated;
