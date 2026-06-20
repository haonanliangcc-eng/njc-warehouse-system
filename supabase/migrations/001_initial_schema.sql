-- NJC warehouse operations cloud schema.
-- Run this in the Supabase SQL editor after creating a project.
-- Do not paste real passwords or service keys into this file.

create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('admin', 'supervisor', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_status as enum ('draft', 'submitted', 'locked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type carrier_code as enum ('GOFO', 'SPX', 'DD301', 'UNI', 'TEMU', 'OTHER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type incident_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type incident_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type signature_type as enum ('handover', 'receiver', 'supervisor', 'manager');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  role app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  shift text not null default '早班',
  status report_status not null default 'draft',
  general_notes text not null default '',
  version integer not null default 1,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, shift)
);

create table if not exists public.shipment_records (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  carrier carrier_code not null,
  package_count integer not null default 0 check (package_count >= 0),
  pallet_count integer not null default 0 check (pallet_count >= 0),
  pickup_time timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labor_records (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  labor_company text not null default '',
  headcount integer not null default 0 check (headcount >= 0),
  work_hours numeric(8,2) not null default 0 check (work_hours >= 0),
  processed_quantity integer not null default 0 check (processed_quantity >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_records (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  shift text not null default '早班',
  task_name text not null,
  assigned_to text not null default '',
  completed boolean not null default false,
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  category text not null default 'general',
  description text not null,
  severity incident_severity not null default 'medium',
  action_taken text not null default '',
  owner_id uuid references public.profiles(id),
  status incident_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incident_photos (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.handover_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  description text not null,
  priority text not null default 'normal',
  assigned_to text not null default '',
  due_at timestamptz,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  signature_type signature_type not null,
  signer_id uuid references public.profiles(id),
  signer_name text not null,
  signed_at timestamptz not null default now(),
  storage_path text,
  unique (report_id, signature_type)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_daily_reports_date on public.daily_reports(report_date desc);
create index if not exists idx_daily_reports_created_by on public.daily_reports(created_by);
create index if not exists idx_shipments_report on public.shipment_records(report_id);
create index if not exists idx_labor_report on public.labor_records(report_id);
create index if not exists idx_tasks_report on public.task_records(report_id);
create index if not exists idx_incidents_report on public.incidents(report_id);
create index if not exists idx_incidents_owner on public.incidents(owner_id);
create index if not exists idx_incident_photos_incident on public.incident_photos(incident_id);
create index if not exists idx_handover_report on public.handover_items(report_id);
create index if not exists idx_signatures_report on public.signatures(report_id);
create index if not exists idx_audit_logs_user_created on public.audit_logs(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at before update on public.daily_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_shipment_records_updated_at on public.shipment_records;
create trigger set_shipment_records_updated_at before update on public.shipment_records
for each row execute function public.set_updated_at();

drop trigger if exists set_labor_records_updated_at on public.labor_records;
create trigger set_labor_records_updated_at before update on public.labor_records
for each row execute function public.set_updated_at();

drop trigger if exists set_task_records_updated_at on public.task_records;
create trigger set_task_records_updated_at before update on public.task_records
for each row execute function public.set_updated_at();

drop trigger if exists set_incidents_updated_at on public.incidents;
create trigger set_incidents_updated_at before update on public.incidents
for each row execute function public.set_updated_at();

drop trigger if exists set_handover_items_updated_at on public.handover_items;
create trigger set_handover_items_updated_at before update on public.handover_items
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'::app_role;
$$;

create or replace function public.can_write_business_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin'::app_role, 'supervisor'::app_role);
$$;

create or replace function public.prevent_self_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and old.role is distinct from new.role then
    raise exception 'Users cannot change their own role';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_admin_escalation on public.profiles;
create trigger prevent_self_admin_escalation before update on public.profiles
for each row execute function public.prevent_self_admin_escalation();

alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.shipment_records enable row level security;
alter table public.labor_records enable row level security;
alter table public.task_records enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_photos enable row level security;
alter table public.handover_items enable row level security;
alter table public.signatures enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read self or admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles update admin only" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles insert admin only" on public.profiles
for insert to authenticated
with check (public.is_admin());

create policy "profiles delete admin only" on public.profiles
for delete to authenticated
using (public.is_admin());

create policy "business read authenticated" on public.daily_reports
for select to authenticated
using (public.current_user_role() in ('admin'::app_role, 'supervisor'::app_role, 'viewer'::app_role));

create policy "daily reports write admin supervisor" on public.daily_reports
for insert to authenticated
with check (public.can_write_business_data() and created_by = auth.uid());

create policy "daily reports update admin supervisor" on public.daily_reports
for update to authenticated
using (public.can_write_business_data())
with check (public.can_write_business_data() and updated_by = auth.uid());

create policy "daily reports delete admin only" on public.daily_reports
for delete to authenticated
using (public.is_admin());

create policy "shipment read authenticated" on public.shipment_records for select to authenticated using (public.current_user_role() is not null);
create policy "shipment write admin supervisor" on public.shipment_records for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "labor read authenticated" on public.labor_records for select to authenticated using (public.current_user_role() is not null);
create policy "labor write admin supervisor" on public.labor_records for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "tasks read authenticated" on public.task_records for select to authenticated using (public.current_user_role() is not null);
create policy "tasks write admin supervisor" on public.task_records for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "incidents read authenticated" on public.incidents for select to authenticated using (public.current_user_role() is not null);
create policy "incidents write admin supervisor" on public.incidents for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "incident photos read authenticated" on public.incident_photos for select to authenticated using (public.current_user_role() is not null);
create policy "incident photos write admin supervisor" on public.incident_photos for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "handover read authenticated" on public.handover_items for select to authenticated using (public.current_user_role() is not null);
create policy "handover write admin supervisor" on public.handover_items for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "signatures read authenticated" on public.signatures for select to authenticated using (public.current_user_role() is not null);
create policy "signatures write admin supervisor" on public.signatures for all to authenticated using (public.can_write_business_data()) with check (public.can_write_business_data());

create policy "audit read admin only" on public.audit_logs for select to authenticated using (public.is_admin());
create policy "audit insert admin supervisor" on public.audit_logs for insert to authenticated with check (public.current_user_role() in ('admin'::app_role, 'supervisor'::app_role));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'warehouse-files',
  'warehouse-files',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "warehouse files read authenticated" on storage.objects
for select to authenticated
using (bucket_id = 'warehouse-files' and public.current_user_role() is not null);

create policy "warehouse files upload admin supervisor" on storage.objects
for insert to authenticated
with check (bucket_id = 'warehouse-files' and public.can_write_business_data());

create policy "warehouse files update admin supervisor" on storage.objects
for update to authenticated
using (bucket_id = 'warehouse-files' and public.can_write_business_data())
with check (bucket_id = 'warehouse-files' and public.can_write_business_data());

create policy "warehouse files delete admin supervisor" on storage.objects
for delete to authenticated
using (bucket_id = 'warehouse-files' and public.can_write_business_data());

-- First admin creation:
-- 1. Create the user in Supabase Dashboard > Authentication > Users.
-- 2. Copy that user's auth.users.id.
-- 3. Run:
-- insert into public.profiles (id, full_name, email, role, is_active)
-- values ('AUTH_USER_ID_HERE', 'Admin Name', 'admin@example.com', 'admin', true)
-- on conflict (id) do update set role = 'admin', is_active = true, updated_at = now();
