-- Phase: Home Automation module
-- Adds a normalized, property-scoped smart-home inventory: devices, hubs,
-- networks, automations (routines/scenes), typed dependency relationships, and
-- history tables (health/battery/firmware). Follows existing conventions:
--   * property_id on every table (uniform RLS via is_property_member/editor)
--   * uuid pk, created_by, created_at/updated_at, deleted_at soft delete
--   * set_updated_at() trigger
-- Category / protocol / ecosystem are app-validated text (expandable without a
-- schema redesign). Small stable sets use CHECK constraints.
-- SECRETS: only *reference* fields (e.g. password-manager item names) are stored.
-- Never store passwords, codes, keys, or tokens in these tables.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- NETWORKS
-- ---------------------------------------------------------------------------
create table if not exists public.automation_networks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  network_type text not null default 'wifi'
    check (network_type in ('wifi','ethernet','mesh','iot_vlan','guest','backup','other')),
  ssid text,
  router_model text,
  gateway text,
  mesh_system text,
  access_points text,
  vlan text,
  subnet text,
  dns_notes text,
  dhcp_range text,
  internet_provider text,
  modem text,
  backup_internet text,
  is_guest boolean not null default false,
  is_iot boolean not null default false,
  security_notes text,
  physical_location text,
  ups_backup text,
  setup_instructions text,
  recovery_instructions text,
  replacement_instructions text,
  -- secure reference only; never a real credential
  credential_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- HUBS / BRIDGES / CONTROLLERS
-- ---------------------------------------------------------------------------
create table if not exists public.automation_hubs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  network_id uuid references public.automation_networks(id) on delete set null,
  name text not null,
  manufacturer text,
  model text,
  hub_type text not null default 'smart_home_hub'
    check (hub_type in (
      'smart_home_hub','bridge','matter_controller','thread_border_router',
      'security_controller','lighting_controller','hvac_controller',
      'irrigation_controller','local_automation_server','voice_assistant',
      'custom_controller','other'
    )),
  physical_location text,
  ip_address text,
  mac_address text,
  protocols_supported text[] not null default '{}',
  ecosystems_supported text[] not null default '{}',
  local_control boolean not null default true,
  cloud_dependency boolean not null default false,
  internet_dependency boolean not null default false,
  power_source text default 'mains'
    check (power_source in ('mains','battery','solar','poe','usb','hardwired','other')),
  backup_power text,
  firmware_version text,
  account_reference text,
  subscription_required boolean not null default false,
  subscription_renewal_date date,
  setup_instructions text,
  reset_instructions text,
  recovery_steps text,
  backup_method text,
  configuration_export text,
  last_backup_date date,
  replacement_procedure text,
  criticality text not null default 'normal'
    check (criticality in ('low','normal','high','critical')),
  status text not null default 'unknown'
    check (status in ('online','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown')),
  credential_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- DEVICES
-- ---------------------------------------------------------------------------
create table if not exists public.automation_devices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  floor_id uuid references public.floors(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  primary_hub_id uuid references public.automation_hubs(id) on delete set null,
  primary_network_id uuid references public.automation_networks(id) on delete set null,
  parent_device_id uuid references public.automation_devices(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  replacement_device_id uuid references public.automation_devices(id) on delete set null,
  previous_device_id uuid references public.automation_devices(id) on delete set null,

  -- Identity (category is app-validated text so it can expand without a migration)
  name text not null,
  nickname text,
  category text not null default 'other',
  manufacturer text,
  model text,
  model_number text,
  serial_number text,
  hardware_version text,
  purchase_date date,
  installation_date date,
  status text not null default 'unknown'
    check (status in ('online','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown')),
  is_critical boolean not null default false,
  indoor_outdoor text default 'indoor' check (indoor_outdoor in ('indoor','outdoor','both')),
  tags text[] not null default '{}',
  notes text,

  -- Location
  specific_location text,
  mounting_position text,
  nearby_landmark text,
  location_photo_document_id uuid references public.documents(id) on delete set null,

  -- Connectivity (primary_protocol app-validated text; secondary via junction)
  primary_protocol text,

  -- Network details
  ssid_reference text,
  vlan_reference text,
  ip_assignment text check (ip_assignment in ('static','dynamic') or ip_assignment is null),
  ip_address text,
  mac_address text,
  hostname text,
  switch_port text,
  signal_notes text,
  reserved_ip boolean not null default false,
  internet_required boolean not null default false,
  local_control_available boolean not null default true,

  -- Account & access (references only — never secrets)
  service_account_reference text,
  account_owner text,
  signin_email text,
  subscription_required boolean not null default false,
  subscription_renewal_date date,
  recovery_process text,
  two_factor_enabled boolean not null default false,
  credential_reference text,

  -- Power
  power_type text default 'mains'
    check (power_type in ('mains','battery','solar','poe','usb','hardwired','other')),
  backup_battery boolean not null default false,
  battery_type text,
  battery_quantity integer check (battery_quantity is null or battery_quantity >= 0),
  last_battery_replacement date,
  expected_battery_life_months integer check (expected_battery_life_months is null or expected_battery_life_months >= 0),
  low_battery_threshold integer,
  circuit_reference text,
  ups_dependency boolean not null default false,

  -- Operational
  last_checked_date date,
  last_online_date date,
  firmware_version text,
  firmware_update_method text,
  automatic_updates_enabled boolean not null default false,
  last_firmware_update date,
  setup_instructions text,
  pairing_instructions text,
  reset_instructions text,
  factory_reset_instructions text,
  reconnection_steps text,
  replacement_instructions text,
  troubleshooting_notes text,
  disposal_instructions text,
  handover_notes text,

  -- Ownership / lifecycle
  purchased_from text,
  purchase_price numeric(12,2) check (purchase_price is null or purchase_price >= 0),
  warranty_expiration date,
  installer text,
  installation_cost numeric(12,2) check (installation_cost is null or installation_cost >= 0),
  expected_replacement_date date,
  retired_date date,
  disposal_status text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- AUTOMATIONS / SCENES / ROUTINES
-- ---------------------------------------------------------------------------
create table if not exists public.automation_routines (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  routine_type text not null default 'routine'
    check (routine_type in (
      'routine','scene','schedule','rule','security','safety','energy',
      'climate','lighting','presence','accessibility','custom'
    )),
  description text,
  platform text,
  owner text,
  status text not null default 'unknown'
    check (status in ('active','disabled','broken','untested','unknown')),
  criticality text not null default 'normal'
    check (criticality in ('low','normal','high','critical')),
  trigger_text text,
  conditions_text text,
  actions_text text,
  schedule_text text,
  time_zone text,
  occupancy_dependency boolean not null default false,
  presence_dependency boolean not null default false,
  internet_dependency boolean not null default false,
  local_control_available boolean not null default true,
  failure_behavior text,
  manual_override text,
  disable_instructions text,
  reenable_instructions text,
  testing_instructions text,
  last_tested date,
  last_successful_run date,
  last_failed_run date,
  failure_notes text,
  issue_id uuid references public.issues(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- JUNCTIONS (many-to-many) — each carries property_id for uniform RLS
-- ---------------------------------------------------------------------------
create table if not exists public.automation_device_protocols (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  protocol text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (device_id, protocol)
);

create table if not exists public.automation_device_ecosystems (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  ecosystem text not null,
  created_at timestamptz not null default now(),
  unique (device_id, ecosystem)
);

create table if not exists public.automation_device_hubs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  hub_id uuid not null references public.automation_hubs(id) on delete cascade,
  is_primary boolean not null default false,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (device_id, hub_id)
);

create table if not exists public.automation_device_networks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  network_id uuid not null references public.automation_networks(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (device_id, network_id)
);

create table if not exists public.automation_routine_devices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  routine_id uuid not null references public.automation_routines(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  role text not null default 'involved'
    check (role in ('trigger','condition','action','involved')),
  created_at timestamptz not null default now(),
  unique (routine_id, device_id, role)
);

create table if not exists public.automation_routine_hubs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  routine_id uuid not null references public.automation_routines(id) on delete cascade,
  hub_id uuid not null references public.automation_hubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (routine_id, hub_id)
);

create table if not exists public.automation_routine_networks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  routine_id uuid not null references public.automation_routines(id) on delete cascade,
  network_id uuid not null references public.automation_networks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (routine_id, network_id)
);

-- ---------------------------------------------------------------------------
-- RELATIONSHIPS (typed polymorphic edges for the long tail:
-- device<->cloud_service, device<->device, automation<->cloud, power_circuit, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.automation_relationships (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_type text not null
    check (source_type in ('device','hub','network','routine','cloud_service','ecosystem','power_circuit','internet','room')),
  source_id uuid,
  source_label text,
  target_type text not null
    check (target_type in ('device','hub','network','routine','cloud_service','ecosystem','power_circuit','internet','room')),
  target_id uuid,
  target_label text,
  relationship_type text not null default 'depends_on'
    check (relationship_type in ('depends_on','controls','connects_to','bridges','member_of','parent_of','powers','triggers','part_of','other')),
  is_required boolean not null default true,
  is_primary boolean not null default true,
  direction text not null default 'source_to_target'
    check (direction in ('source_to_target','target_to_source','bidirectional')),
  description text,
  failure_impact text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- HISTORY (manual; retention-friendly)
-- ---------------------------------------------------------------------------
create table if not exists public.automation_health_checks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid references public.automation_devices(id) on delete cascade,
  hub_id uuid references public.automation_hubs(id) on delete cascade,
  status text not null
    check (status in ('online','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown')),
  checked_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','future_integration')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint automation_health_target check (device_id is not null or hub_id is not null)
);

create table if not exists public.automation_battery_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid not null references public.automation_devices(id) on delete cascade,
  event_type text not null default 'replaced'
    check (event_type in ('replaced','low','checked','ok')),
  event_date date not null default current_date,
  battery_type text,
  quantity integer check (quantity is null or quantity >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_firmware_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  device_id uuid references public.automation_devices(id) on delete cascade,
  hub_id uuid references public.automation_hubs(id) on delete cascade,
  event_type text not null default 'updated'
    check (event_type in ('updated','checked','update_available','rollback')),
  from_version text,
  to_version text,
  event_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint automation_firmware_target check (device_id is not null or hub_id is not null)
);

-- ---------------------------------------------------------------------------
-- ADDITIVE LINK COLUMNS on existing entities (matches existing multi-link pattern)
-- ---------------------------------------------------------------------------
alter table public.documents
  add column if not exists automation_device_id uuid references public.automation_devices(id) on delete set null,
  add column if not exists automation_hub_id uuid references public.automation_hubs(id) on delete set null,
  add column if not exists automation_routine_id uuid references public.automation_routines(id) on delete set null,
  add column if not exists automation_network_id uuid references public.automation_networks(id) on delete set null;

alter table public.receipts
  add column if not exists automation_device_id uuid references public.automation_devices(id) on delete set null,
  add column if not exists automation_hub_id uuid references public.automation_hubs(id) on delete set null;

alter table public.issues
  add column if not exists automation_device_id uuid references public.automation_devices(id) on delete set null,
  add column if not exists automation_hub_id uuid references public.automation_hubs(id) on delete set null,
  add column if not exists automation_routine_id uuid references public.automation_routines(id) on delete set null;

alter table public.repairs
  add column if not exists automation_device_id uuid references public.automation_devices(id) on delete set null,
  add column if not exists automation_hub_id uuid references public.automation_hubs(id) on delete set null;

alter table public.service_records
  add column if not exists automation_device_id uuid references public.automation_devices(id) on delete set null,
  add column if not exists automation_hub_id uuid references public.automation_hubs(id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'automation_networks','automation_hubs','automation_devices',
    'automation_routines','automation_relationships'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- INDEXES (common filters)
-- ---------------------------------------------------------------------------
create index if not exists automation_devices_property_idx on public.automation_devices (property_id, status, created_at desc) where deleted_at is null;
create index if not exists automation_devices_room_idx on public.automation_devices (room_id) where deleted_at is null and room_id is not null;
create index if not exists automation_devices_category_idx on public.automation_devices (property_id, category) where deleted_at is null;
create index if not exists automation_devices_hub_idx on public.automation_devices (primary_hub_id) where deleted_at is null and primary_hub_id is not null;
create index if not exists automation_devices_network_idx on public.automation_devices (primary_network_id) where deleted_at is null and primary_network_id is not null;
create index if not exists automation_devices_critical_idx on public.automation_devices (property_id) where deleted_at is null and is_critical = true;
create index if not exists automation_hubs_property_idx on public.automation_hubs (property_id, created_at desc) where deleted_at is null;
create index if not exists automation_networks_property_idx on public.automation_networks (property_id, created_at desc) where deleted_at is null;
create index if not exists automation_routines_property_idx on public.automation_routines (property_id, status, created_at desc) where deleted_at is null;
create index if not exists automation_rel_property_idx on public.automation_relationships (property_id) where deleted_at is null;
create index if not exists automation_rel_source_idx on public.automation_relationships (source_type, source_id) where deleted_at is null;
create index if not exists automation_rel_target_idx on public.automation_relationships (target_type, target_id) where deleted_at is null;
create index if not exists automation_dev_protocols_device_idx on public.automation_device_protocols (device_id);
create index if not exists automation_dev_ecosystems_device_idx on public.automation_device_ecosystems (device_id);
create index if not exists automation_dev_hubs_device_idx on public.automation_device_hubs (device_id);
create index if not exists automation_dev_hubs_hub_idx on public.automation_device_hubs (hub_id);
create index if not exists automation_dev_networks_device_idx on public.automation_device_networks (device_id);
create index if not exists automation_routine_devices_routine_idx on public.automation_routine_devices (routine_id);
create index if not exists automation_routine_devices_device_idx on public.automation_routine_devices (device_id);
create index if not exists automation_health_device_idx on public.automation_health_checks (device_id, checked_at desc) where device_id is not null;
create index if not exists automation_battery_device_idx on public.automation_battery_events (device_id, event_date desc);
create index if not exists automation_firmware_device_idx on public.automation_firmware_events (device_id, event_date desc) where device_id is not null;
create index if not exists documents_automation_device_idx on public.documents (automation_device_id) where deleted_at is null and automation_device_id is not null;
create index if not exists issues_automation_device_idx on public.issues (automation_device_id) where deleted_at is null and automation_device_id is not null;
create index if not exists repairs_automation_device_idx on public.repairs (automation_device_id) where deleted_at is null and automation_device_id is not null;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — uniform property-scoped policies
-- select = member, insert/update/delete = editor (matches existing convention)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'automation_networks','automation_hubs','automation_devices','automation_routines',
    'automation_relationships','automation_device_protocols','automation_device_ecosystems',
    'automation_device_hubs','automation_device_networks','automation_routine_devices',
    'automation_routine_hubs','automation_routine_networks','automation_health_checks',
    'automation_battery_events','automation_firmware_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (public.is_property_member(property_id))',
      t, t
    );

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert with check (public.is_property_editor(property_id))',
      t, t
    );

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id))',
      t, t
    );

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete using (public.is_property_editor(property_id))',
      t, t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
