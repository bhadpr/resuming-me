-- An iPhone can join a walking challenge. A computer still cannot.
-- The live function bodies stay as they are, including the membership cap of 5.

begin;

do $$
declare
  src text;
  next text;
begin
  src := pg_get_functiondef('public.join_walking_challenge(text,uuid,text)'::regprocedure);
  next := replace(src, '<> ''android''', 'not in (''android'', ''ios'')');
  if next = src then
    raise exception 'join_walking_challenge platform check was not found';
  end if;
  execute next;

  src := pg_get_functiondef('public.create_walking_challenge(text,text,date,date,bigint,text[],text,boolean,int,text,text)'::regprocedure);
  next := replace(src, '<> ''android''', 'not in (''android'', ''ios'')');
  if next = src then
    raise exception 'create_walking_challenge platform check was not found';
  end if;
  execute next;
end $$;

commit;
