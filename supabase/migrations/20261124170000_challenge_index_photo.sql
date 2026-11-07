-- Today only needs the card picture. The score function is the slow part, so the list carries the path.

drop function public.my_challenge_index();

create function public.my_challenge_index()
returns table (role text, code text, title text, card_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  return query
  select 'member'::text, c.code, c.title, c.photo_path
  from public.challenge_members m
  join public.challenges c on c.id = m.challenge_id
  where m.user_id = uid
    and m.left_on is null
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind = 'walk'
  order by c.created_at
  limit 3;

  return query
  select 'run'::text, c.code, c.title, c.photo_path
  from public.challenges c
  where c.owner_id = uid
    and c.status in ('active', 'switched_off', 'ended')
    and c.kind = 'walk'
    and not exists (
      select 1 from public.challenge_members m
      where m.challenge_id = c.id and m.user_id = uid and m.left_on is null
    )
  order by c.created_at;
end;
$$;

revoke all on function public.my_challenge_index() from public;
grant execute on function public.my_challenge_index() to authenticated;
