-- Tag each bottle as homeopathic, allopathic, or Ayurvedic for later charts.
alter table public.medicines add column if not exists system text;

alter table public.medicines drop constraint if exists medicines_system;

alter table public.medicines add constraint medicines_system
  check (system is null or system in ('homeopathic', 'allopathic', 'ayurvedic'));
