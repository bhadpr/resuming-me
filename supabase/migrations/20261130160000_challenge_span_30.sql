-- A challenge can last 1 to 30 days, counting the start day.
-- The organizer picks the end date for a race and for a shared goal.

begin;

do $span$
declare
  src text;
  next text;
begin
  src := pg_get_functiondef('public.create_walking_challenge(text,text,date,date,bigint,text[],text,boolean,int,text,text)'::regprocedure);
  next := src;
  next := replace(next, 'p_ends_on := p_starts_on + 6;' || chr(10) || '    p_target := null;', 'p_target := null;');
  next := replace(
    next,
    'if p_shape = ''race'' then' || chr(10) || '    p_target := null;',
    'if p_ends_on is null or (p_ends_on - p_starts_on) not between 0 and 29 then' || chr(10) ||
    '    raise exception ''challenge_bad_dates'' using errcode = ''P0001'';' || chr(10) ||
    '  end if;' || chr(10) || chr(10) ||
    '  if p_shape = ''race'' then' || chr(10) || '    p_target := null;'
  );
  next := replace(
    next,
    '(p_ends_on - p_starts_on) not between 6 and 365',
    '(p_ends_on - p_starts_on) not between 0 and 29'
  );
  if position('between 0 and 29' in next) = 0 or position('p_starts_on + 6' in next) > 0 then
    raise exception 'challenge span was not updated';
  end if;
  execute next;
end
$span$;

commit;
