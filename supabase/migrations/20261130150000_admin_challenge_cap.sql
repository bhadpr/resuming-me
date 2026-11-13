-- An admin account can create 50 open challenges and be in 50.
-- Everyone else stays at 5. The live function bodies stay as they are.

begin;

do $cap$
declare
  src text;
  next text;
  fn text;
  creator_block text := $sql$
  if coalesce(public.is_current_user_admin(), false) then
    if open_created >= 50 then
      raise exception 'challenge_creator_cap_admin' using errcode = 'P0001';
    end if;
  elsif open_created >= 5 then
    raise exception 'challenge_creator_cap' using errcode = 'P0001';
  end if;$sql$;
  member_block text := $sql$
  if coalesce(public.is_current_user_admin(), false) then
    if open_joined >= 50 then
      raise exception 'challenge_member_cap_admin' using errcode = 'P0001';
    end if;
  elsif open_joined >= 5 then
    raise exception 'challenge_member_cap' using errcode = 'P0001';
  end if;$sql$;
begin
  foreach fn in array array[
    'public.create_walking_challenge(text,text,date,date,bigint,text[],text,boolean,int,text,text)',
    'public.join_walking_challenge(text,uuid,text)'
  ]
  loop
    src := pg_get_functiondef(fn::regprocedure);
    next := src;
    next := regexp_replace(
      next,
      'if open_created >= 5 then\s+raise exception ''challenge_creator_cap'' using errcode = ''P0001'';\s+end if;',
      creator_block,
      'n'
    );
    next := regexp_replace(
      next,
      'if open_joined >= 5 then\s+raise exception ''challenge_member_cap'' using errcode = ''P0001'';\s+end if;',
      member_block,
      'n'
    );
    if fn like '%create_walking_challenge%' and (
      position('challenge_creator_cap_admin' in next) = 0
      or position('challenge_member_cap_admin' in next) = 0
    ) then
      raise exception 'create caps were not both updated';
    end if;
    if fn like '%join_walking_challenge%' and position('challenge_member_cap_admin' in next) = 0 then
      raise exception 'join cap was not updated';
    end if;
    execute next;
  end loop;
end
$cap$;

commit;
