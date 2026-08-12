-- Feedback submissions from the app footer / Feedback page

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  liked text,
  improve text,
  wish text,
  name text,
  email text,
  created_at timestamptz not null default now(),
  constraint feedback_liked_len check (liked is null or char_length(liked) <= 4000),
  constraint feedback_improve_len check (improve is null or char_length(improve) <= 4000),
  constraint feedback_wish_len check (wish is null or char_length(wish) <= 4000),
  constraint feedback_name_len check (name is null or char_length(name) <= 200),
  constraint feedback_email_len check (email is null or char_length(email) <= 320)
);

create index feedback_created_at_idx on public.feedback (created_at desc);
create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

-- Signed-in and anonymous visitors can submit feedback.
create policy "Anyone can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

-- Users can read their own submissions (admins use service role).
create policy "Users can view own feedback"
  on public.feedback for select
  to authenticated
  using (auth.uid() = user_id);

grant select, insert on table public.feedback to authenticated;
grant insert on table public.feedback to anon;
