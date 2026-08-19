-- Let site admins read every feedback submission from the Analytics-style admin UI.

drop policy if exists "Admins can read all feedback" on public.feedback;
create policy "Admins can read all feedback"
  on public.feedback for select
  to authenticated
  using (public.is_current_user_admin());

comment on policy "Admins can read all feedback" on public.feedback is
  'Site operators can review all feedback. Grant is_admin via SQL only.';
