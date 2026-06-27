-- Phase 6G issues and trend flags
-- Moves issues and trend flags to Supabase for signed-in users while keeping property RLS boundaries.

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

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  repair_id uuid references public.repairs(id) on delete set null,
  title text not null,
  description text,
  issue_type text not null default 'general',
  status text not null default 'open',
  severity text not null default 'medium',
  first_seen_date date,
  last_seen_date date,
  resolved_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.issues
  add column if not exists repair_id uuid references public.repairs(id) on delete set null,
  add column if not exists first_seen_date date,
  add column if not exists last_seen_date date,
  add column if not exists resolved_date date,
  add column if not exists notes text,
  add column if not exists date_found date,
  add column if not exists resolution_date date,
  add column if not exists private_notes text,
  add column if not exists shareable_notes text,
  add column if not exists visibility text not null default 'private',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.issues
  alter column id set default gen_random_uuid(),
  alter column issue_type set default 'general',
  alter column status set default 'open',
  alter column severity set default 'medium',
  alter column date_found drop not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.issues drop constraint if exists issues_issue_type_check;
alter table public.issues drop constraint if exists issues_status_check;
alter table public.issues drop constraint if exists issues_severity_check;

update public.issues
set
  issue_type = case
    when issue_type in (
      'general','water_leak','electrical','hvac','appliance','structural','roof','pest','mold',
      'safety','utility','smart_home','cosmetic','other'
    ) then issue_type
    when issue_type in ('leak','flood','plumbing_issue') then 'water_leak'
    when issue_type = 'electrical_issue' then 'electrical'
    when issue_type = 'hvac_issue' then 'hvac'
    when issue_type = 'appliance_issue' then 'appliance'
    when issue_type = 'structural_issue' then 'structural'
    when issue_type = 'roof_issue' then 'roof'
    when issue_type in ('fire','security_issue') then 'safety'
    when issue_type = 'storm_damage' then 'structural'
    else 'other'
  end,
  status = case
    when status in ('open','monitoring','scheduled','in_progress','resolved','dismissed') then status
    when status = 'watching' then 'monitoring'
    when status = 'archived' then 'dismissed'
    else 'open'
  end,
  severity = case
    when severity in ('low','medium','high','urgent') then severity
    else 'medium'
  end,
  first_seen_date = coalesce(first_seen_date, date_found),
  last_seen_date = coalesce(last_seen_date, date_found),
  resolved_date = coalesce(resolved_date, resolution_date),
  notes = coalesce(notes, private_notes, shareable_notes)
where true;

alter table public.issues
  add constraint issues_issue_type_check
  check (
    issue_type in (
      'general','water_leak','electrical','hvac','appliance','structural','roof','pest','mold',
      'safety','utility','smart_home','cosmetic','other'
    )
  );

alter table public.issues
  add constraint issues_status_check
  check (status in ('open','monitoring','scheduled','in_progress','resolved','dismissed'));

alter table public.issues
  add constraint issues_severity_check
  check (severity in ('low','medium','high','urgent'));

drop trigger if exists issues_set_updated_at on public.issues;
create trigger issues_set_updated_at
before update on public.issues
for each row execute function public.set_updated_at();

create table if not exists public.trend_flags (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  flag_type text not null default 'manual_flag',
  title text not null,
  description text,
  severity text not null default 'medium',
  status text not null default 'active',
  detected_from text not null default 'manual',
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.trend_flags
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists utility_id uuid references public.utilities(id) on delete set null,
  add column if not exists issue_id uuid references public.issues(id) on delete set null,
  add column if not exists description text,
  add column if not exists severity text not null default 'medium',
  add column if not exists status text not null default 'active',
  add column if not exists detected_from text not null default 'manual',
  add column if not exists first_detected_at timestamptz not null default now(),
  add column if not exists last_detected_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.trend_flags
  alter column id set default gen_random_uuid(),
  alter column flag_type set default 'manual_flag',
  alter column severity set default 'medium',
  alter column status set default 'active',
  alter column detected_from set default 'manual',
  alter column first_detected_at set default now(),
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.trend_flags drop constraint if exists trend_flags_flag_type_check;
alter table public.trend_flags drop constraint if exists trend_flags_severity_check;
alter table public.trend_flags drop constraint if exists trend_flags_status_check;
alter table public.trend_flags drop constraint if exists trend_flags_detected_from_check;

update public.trend_flags
set
  flag_type = case
    when flag_type in (
      'repeat_issue','recurring_repair','rising_cost','maintenance_overdue','warranty_risk',
      'safety_pattern','water_risk','hvac_pattern','electrical_pattern','manual_flag','other'
    ) then flag_type
    else 'other'
  end,
  severity = case
    when severity in ('low','medium','high','urgent') then severity
    else 'medium'
  end,
  status = case
    when status in ('active','monitoring','resolved','dismissed') then status
    else 'active'
  end,
  detected_from = case
    when detected_from in (
      'manual','issue_history','repair_history','service_history','reminder_history','system_suggestion'
    ) then detected_from
    else 'manual'
  end
where true;

alter table public.trend_flags
  add constraint trend_flags_flag_type_check
  check (
    flag_type in (
      'repeat_issue','recurring_repair','rising_cost','maintenance_overdue','warranty_risk',
      'safety_pattern','water_risk','hvac_pattern','electrical_pattern','manual_flag','other'
    )
  );

alter table public.trend_flags
  add constraint trend_flags_severity_check
  check (severity in ('low','medium','high','urgent'));

alter table public.trend_flags
  add constraint trend_flags_status_check
  check (status in ('active','monitoring','resolved','dismissed'));

alter table public.trend_flags
  add constraint trend_flags_detected_from_check
  check (
    detected_from in (
      'manual','issue_history','repair_history','service_history','reminder_history','system_suggestion'
    )
  );

drop trigger if exists trend_flags_set_updated_at on public.trend_flags;
create trigger trend_flags_set_updated_at
before update on public.trend_flags
for each row execute function public.set_updated_at();

alter table public.issues enable row level security;
alter table public.trend_flags enable row level security;

drop policy if exists p6a_issues_select on public.issues;
drop policy if exists p6g_issues_select on public.issues;
create policy p6g_issues_select on public.issues
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_issues_insert on public.issues;
drop policy if exists p6g_issues_insert on public.issues;
create policy p6g_issues_insert on public.issues
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6a_issues_update on public.issues;
drop policy if exists p6g_issues_update on public.issues;
create policy p6g_issues_update on public.issues
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6a_issues_delete on public.issues;
drop policy if exists p6g_issues_delete on public.issues;

drop policy if exists p6g_trend_flags_select on public.trend_flags;
create policy p6g_trend_flags_select on public.trend_flags
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6g_trend_flags_insert on public.trend_flags;
create policy p6g_trend_flags_insert on public.trend_flags
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6g_trend_flags_update on public.trend_flags;
create policy p6g_trend_flags_update on public.trend_flags
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6g_trend_flags_delete on public.trend_flags;

create index if not exists issues_property_status_idx
on public.issues (property_id, status, severity, created_at desc)
where deleted_at is null;

create index if not exists issues_room_idx
on public.issues (room_id)
where deleted_at is null and room_id is not null;

create index if not exists issues_asset_idx
on public.issues (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists issues_utility_idx
on public.issues (utility_id)
where deleted_at is null and utility_id is not null;

create index if not exists issues_repair_idx
on public.issues (repair_id)
where deleted_at is null and repair_id is not null;

create index if not exists trend_flags_property_status_idx
on public.trend_flags (property_id, status, severity, created_at desc)
where deleted_at is null;

create index if not exists trend_flags_room_idx
on public.trend_flags (room_id)
where deleted_at is null and room_id is not null;

create index if not exists trend_flags_asset_idx
on public.trend_flags (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists trend_flags_utility_idx
on public.trend_flags (utility_id)
where deleted_at is null and utility_id is not null;

create index if not exists trend_flags_issue_idx
on public.trend_flags (issue_id)
where deleted_at is null and issue_id is not null;
