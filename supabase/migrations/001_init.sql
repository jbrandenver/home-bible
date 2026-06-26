-- Initial migration for Home Bible MVP
-- Creates required tables and enables RLS with owner/member based policies

-- profiles
create table if not exists profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles_self_access" on profiles
  for all using (auth.uid() = id)
  with check (auth.uid() = id);

-- households
create table if not exists households (
  id uuid primary key,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table households enable row level security;
-- household membership; basic policies to allow members to be added by authenticated users
create table if not exists household_members (
  id uuid primary key,
  household_id uuid references households(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz default now()
);
alter table household_members enable row level security;
create policy "household_members_insert_self" on household_members
  for insert with check (auth.uid() = user_id);
create policy "household_members_select_by_member" on household_members
  for select using (auth.uid() = user_id);

-- properties and members
create table if not exists properties (
  id uuid primary key,
  household_id uuid references households(id) on delete cascade,
  owner_user_id uuid references profiles(id) not null,
  nickname text not null,
  property_type text not null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  state text null,
  postal_code text null,
  country text null,
  address_is_enabled boolean default false,
  square_feet integer null,
  year_built integer null,
  floor_count integer null,
  has_garage boolean default false,
  has_basement boolean default false,
  has_attic boolean default false,
  has_crawl_space boolean default false,
  has_yard boolean default false,
  has_shed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null
);
alter table properties enable row level security;

create table if not exists property_members (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz default now()
);
alter table property_members enable row level security;

-- floors
create table if not exists floors (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  name text not null,
  floor_number integer not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table floors enable row level security;

-- rooms
create table if not exists rooms (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  floor_id uuid references floors(id) on delete set null,
  name text not null,
  room_type text not null,
  sort_order integer default 0,
  notes text null,
  outlet_count integer null,
  switch_count integer null,
  vent_count integer null,
  vent_type text null,
  breaker_label text null,
  has_plumbing boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null
);
alter table rooms enable row level security;

-- utilities
create table if not exists utilities (
  id uuid primary key,
  property_id uuid references properties(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  utility_type text not null,
  name text not null,
  location_notes text null,
  emergency_notes text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null
);
alter table utilities enable row level security;

-- audit_events
create table if not exists audit_events (
  id uuid primary key,
  user_id uuid references profiles(id) null,
  event_type text not null,
  event_payload jsonb null,
  created_at timestamptz default now()
);
alter table audit_events enable row level security;

-- Policies: helper macros aren't available in plain SQL migrations, so add policies directly

-- profiles: already restricted to self access above

-- properties access: owners and members may select
create policy "properties_select_owner_or_member" on properties
  for select using (
    owner_user_id = auth.uid()
    OR EXISTS (select 1 from property_members pm where pm.property_id = properties.id and pm.user_id = auth.uid())
  );

create policy "properties_insert_owner" on properties
  for insert with check (owner_user_id = auth.uid());

create policy "properties_update_owner" on properties
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "properties_delete_owner" on properties
  for delete using (owner_user_id = auth.uid());

-- property_members: users can view their own membership rows
create policy "property_members_select_self" on property_members
  for select using (user_id = auth.uid());

create policy "property_members_insert_self" on property_members
  for insert with check (user_id = auth.uid());

-- floors/rooms/utilities: derive access from properties
create policy "floors_select_via_property" on floors
  for select using (
    EXISTS (select 1 from properties p where p.id = floors.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );
create policy "rooms_select_via_property" on rooms
  for select using (
    EXISTS (select 1 from properties p where p.id = rooms.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );
create policy "utilities_select_via_property" on utilities
  for select using (
    EXISTS (select 1 from properties p where p.id = utilities.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );

-- For inserts to floors/rooms/utilities require that the user is owner or member of the property
create policy "floors_insert_allowed" on floors
  for insert with check (
    EXISTS (select 1 from properties p where p.id = new.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );

create policy "rooms_insert_allowed" on rooms
  for insert with check (
    EXISTS (select 1 from properties p where p.id = new.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );

create policy "utilities_insert_allowed" on utilities
  for insert with check (
    EXISTS (select 1 from properties p where p.id = new.property_id and (p.owner_user_id = auth.uid() OR EXISTS (select 1 from property_members pm where pm.property_id = p.id and pm.user_id = auth.uid())))
  );

-- audit_events: allow inserts by authenticated users
create policy "audit_insert_authenticated" on audit_events
  for insert with check (auth.role() is not null);

-- Notes:
-- - RLS is enabled for all tables above.
-- - Policies are conservative: reads require owner or explicit membership.
-- - Service role keys must never be included in frontend code; use Edge Functions or server-side processes for privileged actions.
