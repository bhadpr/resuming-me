-- Supabase grants anon execute on new public functions by default. These are for signed-in people only.
revoke execute on function public.shared_events_links_today(uuid) from anon;
revoke execute on function public.shared_event_code_retired(text) from anon;
revoke execute on function public.my_shared_event(uuid) from anon;
revoke execute on function public.reset_shared_event_code(uuid) from anon;
revoke execute on function public.admin_shared_events() from anon;
