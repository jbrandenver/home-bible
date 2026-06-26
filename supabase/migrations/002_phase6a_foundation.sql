-- Phase 6A foundation migration
-- Secure Supabase schema + RLS foundations while keeping localStorage UI flow intact.

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

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Households
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','co_owner','editor','viewer','maintenance_guest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, user_id)
);

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

-- Properties + Members
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  property_type text not null check (
    property_type in (
      'single_family_home','condo','apartment','townhome','duplex','cabin','rental_home'
    )
  ),
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  address_is_enabled boolean not null default false,
  square_feet integer,
  year_built integer,
  floor_count integer,
  has_garage boolean not null default false,
  has_basement boolean not null default false,
  has_attic boolean not null default false,
  has_crawl_space boolean not null default false,
  has_yard boolean not null default false,
  has_shed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create table if not exists public.property_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','co_owner','editor','viewer','maintenance_guest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (property_id, user_id)
);

drop trigger if exists property_members_set_updated_at on public.property_members;
create trigger property_members_set_updated_at
before update on public.property_members
for each row execute function public.set_updated_at();

-- Floors + Rooms
create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  floor_number integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists floors_set_updated_at on public.floors;
create trigger floors_set_updated_at
before update on public.floors
for each row execute function public.set_updated_at();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  floor_id uuid references public.floors(id) on delete set null,
  name text not null,
  room_type text not null check (
    room_type in (
      'bedroom','bathroom','kitchen','living_room','dining_room','office','laundry_room','garage',
      'basement','attic','crawl_space','utility_room','closet','hallway','entryway','exterior',
      'yard','shed','patio','deck','other'
    )
  ),
  sort_order integer not null default 0,
  notes text,
  outlet_count integer,
  switch_count integer,
  vent_count integer,
  vent_type text,
  breaker_label text,
  has_plumbing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

-- Utilities + Systems
create table if not exists public.utilities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  utility_type text not null check (
    utility_type in (
      'main_water_shutoff','electrical_panel','gas_shutoff','water_heater','hvac_unit','furnace',
      'air_conditioner','breaker_panel','sump_pump','irrigation_shutoff','internet_modem','router',
      'smoke_detector','carbon_monoxide_detector','other'
    )
  ),
  name text not null,
  location_notes text,
  emergency_notes text,
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists utilities_set_updated_at on public.utilities;
create trigger utilities_set_updated_at
before update on public.utilities
for each row execute function public.set_updated_at();

create table if not exists public.systems (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  system_type text,
  name text not null,
  notes text,
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists systems_set_updated_at on public.systems;
create trigger systems_set_updated_at
before update on public.systems
for each row execute function public.set_updated_at();

-- Assets
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  asset_type text not null check (
    asset_type in (
      'appliance','accessory','smart_device','tool','fixture','furniture','electronics',
      'outdoor_equipment','home_system_component','other'
    )
  ),
  name text not null,
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(12,2),
  retailer text,
  warranty_length_months integer,
  warranty_expires_at date,
  manual_url text,
  support_url text,
  notes text,
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null,
  reminder_type text not null check (reminder_type in ('warranty_expiration','hvac_filter','custom')),
  due_date date not null,
  linked_type text check (linked_type in ('property','room','utility','asset')),
  linked_id uuid,
  repeat_rule text,
  status text not null default 'open' check (status in ('open','done','snoozed')),
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

-- Service Records
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  service_type text not null check (
    service_type in (
      'repair','inspection','replacement','installation','remodel','cleaning','maintenance','emergency_issue'
    )
  ),
  title text not null,
  description text,
  service_date date not null,
  cost numeric(12,2),
  vendor_name text,
  vendor_phone text,
  vendor_email text,
  follow_up_needed boolean not null default false,
  follow_up_date date,
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists service_records_set_updated_at on public.service_records;
create trigger service_records_set_updated_at
before update on public.service_records
for each row execute function public.set_updated_at();

-- Issues
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  issue_type text not null check (
    issue_type in (
      'leak','flood','fire','mold','pest','storm_damage','electrical_issue','plumbing_issue',
      'hvac_issue','structural_issue','roof_issue','appliance_issue','security_issue','other'
    )
  ),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','watching','scheduled','resolved','archived')),
  severity text not null default 'medium' check (severity in ('low','medium','high','urgent')),
  date_found date not null,
  resolution_date date,
  private_notes text,
  shareable_notes text,
  visibility text not null default 'private' check (visibility in ('private','family','maintenance','buyer_report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists issues_set_updated_at on public.issues;
create trigger issues_set_updated_at
before update on public.issues
for each row execute function public.set_updated_at();

-- Audit Events
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  event_type text not null,
  event_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists audit_events_set_updated_at on public.audit_events;
create trigger audit_events_set_updated_at
before update on public.audit_events
for each row execute function public.set_updated_at();

-- RLS Helper Functions
create or replace function public.is_property_owner(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = target_property_id
      and p.deleted_at is null
      and p.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_property_member(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_property_owner(target_property_id)
    or exists (
      select 1
      from public.property_members pm
      where pm.property_id = target_property_id
        and pm.deleted_at is null
        and pm.user_id = auth.uid()
        and pm.role in ('owner','co_owner','editor','viewer')
    );
$$;

create or replace function public.is_property_editor(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_property_owner(target_property_id)
    or exists (
      select 1
      from public.property_members pm
      where pm.property_id = target_property_id
        and pm.deleted_at is null
        and pm.user_id = auth.uid()
        and pm.role in ('owner','co_owner','editor')
    );
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.deleted_at is null
      and h.owner_user_id = auth.uid()
  );
$$;

-- Enable RLS on every table
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.properties enable row level security;
alter table public.property_members enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.utilities enable row level security;
alter table public.systems enable row level security;
alter table public.assets enable row level security;
alter table public.reminders enable row level security;
alter table public.service_records enable row level security;
alter table public.issues enable row level security;
alter table public.audit_events enable row level security;

-- Profiles policies
drop policy if exists p6a_profiles_self_select on public.profiles;
create policy p6a_profiles_self_select on public.profiles
for select using (id = auth.uid() and deleted_at is null);

drop policy if exists p6a_profiles_self_insert on public.profiles;
create policy p6a_profiles_self_insert on public.profiles
for insert with check (id = auth.uid());

drop policy if exists p6a_profiles_self_update on public.profiles;
create policy p6a_profiles_self_update on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- Household policies
drop policy if exists p6a_households_select_member on public.households;
create policy p6a_households_select_member on public.households
for select using (public.is_household_member(id) and deleted_at is null);

drop policy if exists p6a_households_insert_owner on public.households;
create policy p6a_households_insert_owner on public.households
for insert with check (owner_user_id = auth.uid());

drop policy if exists p6a_households_update_editor on public.households;
create policy p6a_households_update_editor on public.households
for update using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
) with check (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_households_delete_owner on public.households;
create policy p6a_households_delete_owner on public.households
for delete using (owner_user_id = auth.uid());

-- Household members policies
drop policy if exists p6a_household_members_select_member on public.household_members;
create policy p6a_household_members_select_member on public.household_members
for select using (public.is_household_member(household_id) and deleted_at is null);

drop policy if exists p6a_household_members_insert_editor on public.household_members;
create policy p6a_household_members_insert_editor on public.household_members
for insert with check (
  exists (
    select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_household_members_update_editor on public.household_members;
create policy p6a_household_members_update_editor on public.household_members
for update using (
  exists (
    select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
) with check (
  exists (
    select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

drop policy if exists p6a_household_members_delete_editor on public.household_members;
create policy p6a_household_members_delete_editor on public.household_members
for delete using (
  exists (
    select 1 from public.households h where h.id = household_id and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.deleted_at is null
      and hm.user_id = auth.uid()
      and hm.role in ('owner','co_owner','editor')
  )
);

-- Property policies
drop policy if exists p6a_properties_select_member on public.properties;
create policy p6a_properties_select_member on public.properties
for select using (public.is_property_member(id) and deleted_at is null);

drop policy if exists p6a_properties_insert_owner on public.properties;
create policy p6a_properties_insert_owner on public.properties
for insert with check (owner_user_id = auth.uid());

drop policy if exists p6a_properties_update_editor on public.properties;
create policy p6a_properties_update_editor on public.properties
for update using (public.is_property_editor(id)) with check (public.is_property_editor(id));

drop policy if exists p6a_properties_delete_editor on public.properties;
create policy p6a_properties_delete_editor on public.properties
for delete using (public.is_property_editor(id));

-- Property members policies
drop policy if exists p6a_property_members_select_member on public.property_members;
create policy p6a_property_members_select_member on public.property_members
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_property_members_insert_editor on public.property_members;
create policy p6a_property_members_insert_editor on public.property_members
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_property_members_update_editor on public.property_members;
create policy p6a_property_members_update_editor on public.property_members
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_property_members_delete_editor on public.property_members;
create policy p6a_property_members_delete_editor on public.property_members
for delete using (public.is_property_editor(property_id));

-- Child table policies helper template
-- floors
drop policy if exists p6a_floors_select on public.floors;
create policy p6a_floors_select on public.floors
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_floors_insert on public.floors;
create policy p6a_floors_insert on public.floors
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_floors_update on public.floors;
create policy p6a_floors_update on public.floors
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_floors_delete on public.floors;
create policy p6a_floors_delete on public.floors
for delete using (public.is_property_editor(property_id));

-- rooms
drop policy if exists p6a_rooms_select on public.rooms;
create policy p6a_rooms_select on public.rooms
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_rooms_insert on public.rooms;
create policy p6a_rooms_insert on public.rooms
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_rooms_update on public.rooms;
create policy p6a_rooms_update on public.rooms
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_rooms_delete on public.rooms;
create policy p6a_rooms_delete on public.rooms
for delete using (public.is_property_editor(property_id));

-- utilities
drop policy if exists p6a_utilities_select on public.utilities;
create policy p6a_utilities_select on public.utilities
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_utilities_insert on public.utilities;
create policy p6a_utilities_insert on public.utilities
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_utilities_update on public.utilities;
create policy p6a_utilities_update on public.utilities
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_utilities_delete on public.utilities;
create policy p6a_utilities_delete on public.utilities
for delete using (public.is_property_editor(property_id));

-- systems
drop policy if exists p6a_systems_select on public.systems;
create policy p6a_systems_select on public.systems
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_systems_insert on public.systems;
create policy p6a_systems_insert on public.systems
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_systems_update on public.systems;
create policy p6a_systems_update on public.systems
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_systems_delete on public.systems;
create policy p6a_systems_delete on public.systems
for delete using (public.is_property_editor(property_id));

-- assets
drop policy if exists p6a_assets_select on public.assets;
create policy p6a_assets_select on public.assets
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_assets_insert on public.assets;
create policy p6a_assets_insert on public.assets
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_assets_update on public.assets;
create policy p6a_assets_update on public.assets
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_assets_delete on public.assets;
create policy p6a_assets_delete on public.assets
for delete using (public.is_property_editor(property_id));

-- reminders
drop policy if exists p6a_reminders_select on public.reminders;
create policy p6a_reminders_select on public.reminders
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_reminders_insert on public.reminders;
create policy p6a_reminders_insert on public.reminders
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_reminders_update on public.reminders;
create policy p6a_reminders_update on public.reminders
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_reminders_delete on public.reminders;
create policy p6a_reminders_delete on public.reminders
for delete using (public.is_property_editor(property_id));

-- service_records
drop policy if exists p6a_service_records_select on public.service_records;
create policy p6a_service_records_select on public.service_records
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_service_records_insert on public.service_records;
create policy p6a_service_records_insert on public.service_records
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_update on public.service_records;
create policy p6a_service_records_update on public.service_records
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_delete on public.service_records;
create policy p6a_service_records_delete on public.service_records
for delete using (public.is_property_editor(property_id));

-- issues
drop policy if exists p6a_issues_select on public.issues;
create policy p6a_issues_select on public.issues
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_issues_insert on public.issues;
create policy p6a_issues_insert on public.issues
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_issues_update on public.issues;
create policy p6a_issues_update on public.issues
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_issues_delete on public.issues;
create policy p6a_issues_delete on public.issues
for delete using (public.is_property_editor(property_id));

-- audit_events
drop policy if exists p6a_audit_events_select on public.audit_events;
create policy p6a_audit_events_select on public.audit_events
for select using (
  actor_user_id = auth.uid()
  or (property_id is not null and public.is_property_member(property_id))
);

drop policy if exists p6a_audit_events_insert on public.audit_events;
create policy p6a_audit_events_insert on public.audit_events
for insert with check (
  actor_user_id = auth.uid()
  and (property_id is null or public.is_property_member(property_id))
);
