-- Re-run after bhadpr@gmail.com has signed in at least once.
-- Safe to run multiple times.

update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('bhadpr@gmail.com');

select u.email, p.is_admin, p.id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('bhadpr@gmail.com');
