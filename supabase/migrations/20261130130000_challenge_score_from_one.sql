-- The team score shows from the first member.
-- A race day counts when that team had someone. An empty team stays out of the pace.
-- A shared goal shows its total from the first member and includes every day from the start.

begin;

do $$
declare
  src text;
  next text;
  fn text;
begin
  foreach fn in array array[
    'public.walking_challenge_scores(uuid)',
    'public.meditation_challenge_scores(uuid)'
  ]
  loop
    src := pg_get_functiondef(fn::regprocedure);
    next := src;
    next := replace(next, 'and joined >= 3 and phase', 'and joined >= 1 and phase');
    next := replace(next, 'and td.member_count >= 3', 'and td.member_count > 0');
    next := replace(next, 'if live_count >= 3 then', 'if live_count > 0 then');
    if next = src or position('joined >= 1' in next) = 0 or position('member_count > 0' in next) = 0 then
      raise exception 'score gate was not found in %', fn;
    end if;
    execute next;
  end loop;
end $$;

commit;
