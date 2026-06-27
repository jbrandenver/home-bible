-- Phase 6F repairs and service records
-- Moves repairs and service history to Supabase for signed-in users while keeping RLS member/editor boundaries.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.repairs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  title text not null,
  description text,
  repair_type text not null default 'general',
  status text not null default 'open',
  priority text not null default 'normal',
  reported_date date,
  completed_date date,
  contractor_name text,
  contractor_phone text,
  contractor_email text,
  estimated_cost numeric,
  actual_cost numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.repairs
  alter column id set default gen_random_uuid(),
  alter column repair_type set default 'general',
  alter column status set default 'open',
  alter column priority set default 'normal',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.repairs
set
  repair_type = case
    when repair_type in (
      'general','plumbing','electrical','hvac','appliance','roof','exterior','interior','smart_home','utility','other'
    ) then repair_type
    else 'general'
  end,
  status = case
    when status in ('open','scheduled','in_progress','completed','deferred','cancelled') then status
    else 'open'
  end,
  priority = case
    when priority in ('low','normal','high','urgent') then priority
    else 'normal'
  end
where true;

alter table public.repairs drop constraint if exists repairs_repair_type_check;
alter table public.repairs drop constraint if exists repairs_status_check;
alter table public.repairs drop constraint if exists repairs_priority_check;

alter table public.repairs
  add constraint repairs_repair_type_check
  check (
    repair_type in (
      'general','plumbing','electrical','hvac','appliance','roof','exterior','interior','smart_home','utility','other'
    )
  );

alter table public.repairs
  add constraint repairs_status_check
  check (status in ('open','scheduled','in_progress','completed','deferred','cancelled'));

alter table public.repairs
  add constraint repairs_priority_check
  check (priority in ('low','normal','high','urgent'));

drop trigger if exists repairs_set_updated_at on public.repairs;
create trigger repairs_set_updated_at
before update on public.repairs
for each row execute function public.set_updated_at();

create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  service_title text not null,
  service_type text not null default 'maintenance',
  service_date date,
  provider_name text,
  provider_phone text,
  provider_email text,
  cost numeric,
  summary text,
  notes text,
  next_service_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.service_records
  add column if not exists service_title text,
  add column if not exists provider_name text,
  add column if not exists provider_phone text,
  add column if not exists provider_email text,
  add column if not exists summary text,
  add column if not exists notes text,
  add column if not exists next_service_date date,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists vendor_name text,
  add column if not exists vendor_phone text,
  add column if not exists vendor_email text,
  add column if not exists follow_up_needed boolean not null default false,
  add column if not exists follow_up_date date,
  add column if not exists visibility text not null default 'private',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.service_records
  alter column id set default gen_random_uuid(),
  alter column service_type set default 'maintenance',
  alter column service_date drop not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.service_records drop constraint if exists service_records_service_type_check;

update public.service_records
set
  service_type = case
    when service_type in (
      'maintenance','repair','inspection','installation','replacement','cleaning','tune_up','warranty_service','other'
    ) then service_type
    when service_type = 'emergency_issue' then 'repair'
    when service_type = 'remodel' then 'other'
    else 'maintenance'
  end,
  service_title = coalesce(nullif(service_title, ''), nullif(title, ''), 'Untitled service record'),
  title = coalesce(nullif(title, ''), nullif(service_title, ''), 'Untitled service record'),
  provider_name = coalesce(provider_name, vendor_name),
  provider_phone = coalesce(provider_phone, vendor_phone),
  provider_email = coalesce(provider_email, vendor_email),
  summary = coalesce(summary, description),
  next_service_date = coalesce(next_service_date, follow_up_date)
where true;

alter table public.service_records
  alter column service_title set not null;

alter table public.service_records
  add constraint service_records_service_type_check
  check (
    service_type in (
      'maintenance','repair','inspection','installation','replacement','cleaning','tune_up','warranty_service','other'
    )
  );

drop trigger if exists service_records_set_updated_at on public.service_records;
create trigger service_records_set_updated_at
before update on public.service_records
for each row execute function public.set_updated_at();

alter table public.repairs enable row level security;
alter table public.service_records enable row level security;

drop policy if exists p6f_repairs_select on public.repairs;
create policy p6f_repairs_select on public.repairs
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6f_repairs_insert on public.repairs;
create policy p6f_repairs_insert on public.repairs
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6f_repairs_update on public.repairs;
create policy p6f_repairs_update on public.repairs
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_select on public.service_records;
drop policy if exists p6f_service_records_select on public.service_records;
create policy p6f_service_records_select on public.service_records
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_service_records_insert on public.service_records;
drop policy if exists p6f_service_records_insert on public.service_records;
create policy p6f_service_records_insert on public.service_records
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_update on public.service_records;
drop policy if exists p6f_service_records_update on public.service_records;
create policy p6f_service_records_update on public.service_records
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_delete on public.service_records;
drop policy if exists p6f_service_records_delete on public.service_records;

create index if not exists repairs_property_status_idx
on public.repairs (property_id, status, created_at desc)
where deleted_at is null;

create index if not exists repairs_room_idx
on public.repairs (room_id)
where deleted_at is null and room_id is not null;

create index if not exists repairs_asset_idx
on public.repairs (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists repairs_utility_idx
on public.repairs (utility_id)
where deleted_at is null and utility_id is not null;

create index if not exists service_records_property_date_idx
on public.service_records (property_id, service_date desc, created_at desc)
where deleted_at is null;

create index if not exists service_records_room_idx
on public.service_records (room_id)
where deleted_at is null and room_id is not null;

create index if not exists service_records_asset_idx
on public.service_records (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists service_records_utility_idx
on public.service_records (utility_id)
where deleted_at is null and utility_id is not null;
