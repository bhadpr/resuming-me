-- Lower blood pressure sits beside the upper number on the same daily reading.
alter table public.metric_entries
  add column if not exists secondary_value numeric;
