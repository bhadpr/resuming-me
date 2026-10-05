-- No rupees are earned until the group reaches this many qualified installs.
alter table public.marketing_groups
  add column min_payout_installs integer not null default 500;

alter table public.marketing_groups
  add constraint marketing_groups_min_payout check (min_payout_installs >= 0);
