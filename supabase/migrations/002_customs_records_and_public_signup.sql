-- Adds customs broker records used by the daily report page.
-- Run this in Supabase SQL Editor after 001_initial_schema.sql.

create table if not exists public.customs_records (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  broker_name text not null default '',
  status text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  cleared_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customs_records_report on public.customs_records(report_id);

drop trigger if exists set_customs_records_updated_at on public.customs_records;
create trigger set_customs_records_updated_at before update on public.customs_records
for each row execute function public.set_updated_at();

alter table public.customs_records enable row level security;

drop policy if exists "customs read authenticated" on public.customs_records;
create policy "customs read authenticated" on public.customs_records
for select to authenticated
using (public.current_user_role() is not null);

drop policy if exists "customs write admin supervisor" on public.customs_records;
create policy "customs write admin supervisor" on public.customs_records
for all to authenticated
using (public.can_write_business_data())
with check (public.can_write_business_data());
