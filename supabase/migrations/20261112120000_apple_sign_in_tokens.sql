-- Apple refresh tokens, kept so delete-account can tell Apple to forget the sign-in.
-- No policies: only the service role used by the edge function can read or write this.

create table public.apple_sign_in_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  client_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_sign_in_tokens enable row level security;

revoke all on table public.apple_sign_in_tokens from anon, authenticated;
