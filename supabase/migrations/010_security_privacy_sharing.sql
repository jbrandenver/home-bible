-- Full security/privacy remediation.
-- - Drops quarantined 001 policies if they survived in any environment.
-- - Enforces HTTP(S)-only asset links.
-- - Adds creator ownership, role hierarchy guards, visibility-aware RLS, and real invitations.

create extension if not exists pgcrypto;

-- Legacy 001 policy cleanup. These are intentionally explicit so hosted
-- projects with partial/manual migration history converge on the safe policy set.
drop policy if exists profiles_self_access on public.profiles;
drop policy if exists properties_select_owner_or_member on public.properties;
drop policy if exists properties_insert_owner on public.properties;
drop policy if exists properties_update_owner on public.properties;
drop policy if exists properties_delete_owner on public.properties;
drop policy if exists property_members_select_self on public.property_members;
drop policy if exists property_members_insert_self on public.property_members;
drop policy if exists household_members_insert_self on public.household_members;
drop policy if exists household_members_select_by_member on public.household_members;
drop policy if exists floors_select_via_property on public.floors;
drop policy if exists floors_insert_allowed on public.floors;
drop policy if exists floors_update_allowed on public.floors;
drop policy if exists floors_delete_allowed on public.floors;
drop policy if exists rooms_select_via_property on public.rooms;
drop policy if exists rooms_insert_allowed on public.rooms;
drop policy if exists rooms_update_allowed on public.rooms;
drop policy if exists rooms_delete_allowed on public.rooms;
drop policy if exists utilities_select_via_property on public.utilities;
drop policy if exists utilities_insert_allowed on public.utilities;
drop policy if exists utilities_update_allowed on public.utilities;
drop policy if exists utilities_delete_allowed on public.utilities;
drop policy if exists audit_insert_authenticated on public.audit_events;

-- Role constraints now include real scoped read-only guest roles.
alter table public.property_members drop constraint if exists property_members_role_check;
alter table public.property_members
  add constraint property_members_role_check
  check (role in ('owner','co_owner','editor','viewer','maintenance_guest','buyer_preview','insurance_view'));

alter table public.household_members drop constraint if exists household_members_role_check;
alter table public.household_members
  add constraint household_members_role_check
  check (role in ('owner','co_owner','editor','viewer','maintenance_guest','buyer_preview','insurance_view'));

-- URL backfill + constraints for stored user-provided links.
update public.assets
set manual_url = null
where manual_url is not null and manual_url !~* '^https?://';

update public.assets
set support_url = null
where support_url is not null and support_url !~* '^https?://';

alter table public.assets drop constraint if exists assets_http_urls_check;
alter table public.assets
  add constraint assets_http_urls_check
  check (
    (manual_url is null or manual_url ~* '^https?://')
    and (support_url is null or support_url ~* '^https?://')
  );

-- Creator metadata. Existing rows are backfilled to the property owner so
-- historical private records remain visible to the household owner.
alter table public.floors add column if not exists created_by uuid;
alter table public.rooms add column if not exists created_by uuid;
alter table public.utilities add column if not exists created_by uuid;
alter table public.systems add column if not exists created_by uuid;
alter table public.assets add column if not exists created_by uuid;
alter table public.reminders add column if not exists created_by uuid;
alter table public.repairs add column if not exists created_by uuid;
alter table public.service_records add column if not exists created_by uuid;
alter table public.issues add column if not exists created_by uuid;
alter table public.trend_flags add column if not exists created_by uuid;

update public.floors t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.rooms t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.utilities t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.systems t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.assets t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.reminders t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.repairs t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.service_records t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.issues t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;
update public.trend_flags t set created_by = p.owner_user_id
from public.properties p where t.property_id = p.id and t.created_by is null;

create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists floors_set_created_by on public.floors;
create trigger floors_set_created_by before insert on public.floors
for each row execute function public.set_created_by();
drop trigger if exists rooms_set_created_by on public.rooms;
create trigger rooms_set_created_by before insert on public.rooms
for each row execute function public.set_created_by();
drop trigger if exists utilities_set_created_by on public.utilities;
create trigger utilities_set_created_by before insert on public.utilities
for each row execute function public.set_created_by();
drop trigger if exists systems_set_created_by on public.systems;
create trigger systems_set_created_by before insert on public.systems
for each row execute function public.set_created_by();
drop trigger if exists assets_set_created_by on public.assets;
create trigger assets_set_created_by before insert on public.assets
for each row execute function public.set_created_by();
drop trigger if exists reminders_set_created_by on public.reminders;
create trigger reminders_set_created_by before insert on public.reminders
for each row execute function public.set_created_by();
drop trigger if exists repairs_set_created_by on public.repairs;
create trigger repairs_set_created_by before insert on public.repairs
for each row execute function public.set_created_by();
drop trigger if exists service_records_set_created_by on public.service_records;
create trigger service_records_set_created_by before insert on public.service_records
for each row execute function public.set_created_by();
drop trigger if exists issues_set_created_by on public.issues;
create trigger issues_set_created_by before insert on public.issues
for each row execute function public.set_created_by();
drop trigger if exists trend_flags_set_created_by on public.trend_flags;
create trigger trend_flags_set_created_by before insert on public.trend_flags
for each row execute function public.set_created_by();

-- Role/permission helpers.
create or replace function public.current_property_role(target_property_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.properties p
      where p.id = target_property_id
        and p.deleted_at is null
        and p.owner_user_id = auth.uid()
    ) then 'owner'
    else (
      select pm.role
      from public.property_members pm
      where pm.property_id = target_property_id
        and pm.deleted_at is null
        and pm.user_id = auth.uid()
      order by case pm.role
        when 'owner' then 1
        when 'co_owner' then 2
        when 'editor' then 3
        when 'viewer' then 4
        when 'maintenance_guest' then 5
        when 'buyer_preview' then 6
        when 'insurance_view' then 7
        else 99
      end
      limit 1
    )
  end;
$$;

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
  )
  or exists (
    select 1
    from public.property_members pm
    where pm.property_id = target_property_id
      and pm.deleted_at is null
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
  );
$$;

create or replace function public.is_property_owner_or_co_owner(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_owner(target_property_id)
    or exists (
      select 1
      from public.property_members pm
      where pm.property_id = target_property_id
        and pm.deleted_at is null
        and pm.user_id = auth.uid()
        and pm.role = 'co_owner'
    );
$$;

create or replace function public.can_manage_property_members(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_owner_or_co_owner(target_property_id);
$$;

create or replace function public.is_property_member(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_property_role(target_property_id) is not null;
$$;

create or replace function public.is_property_editor(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_property_role(target_property_id) in ('owner','co_owner','editor');
$$;

create or replace function public.can_read_property_row(
  target_property_id uuid,
  row_visibility text,
  row_visibility_contexts text[],
  row_created_by uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text;
  contexts text[];
begin
  role_name := public.current_property_role(target_property_id);
  if role_name is null then
    return false;
  end if;

  if role_name in ('owner','co_owner') then
    return true;
  end if;

  if row_created_by is not null and row_created_by = auth.uid() then
    return true;
  end if;

  contexts := coalesce(row_visibility_contexts, '{}'::text[]);
  if coalesce(array_length(contexts, 1), 0) = 0 then
    contexts := case row_visibility
      when 'family' then array['family']::text[]
      when 'maintenance' then array['maintenance']::text[]
      when 'buyer_report' then array['buyer']::text[]
      else array['personal_archive']::text[]
    end;
  end if;

  if 'personal_archive' = any(contexts) and array_length(contexts, 1) = 1 then
    return false;
  end if;

  return
    (role_name in ('editor','viewer') and 'family' = any(contexts))
    or (role_name = 'maintenance_guest' and 'maintenance' = any(contexts))
    or (role_name = 'buyer_preview' and 'buyer' = any(contexts))
    or (role_name = 'insurance_view' and 'insurance' = any(contexts));
end;
$$;

create or replace function public.can_read_property_documents(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_member(target_property_id);
$$;

create or replace function public.can_write_property_documents(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_editor(target_property_id);
$$;

create or replace function public.current_household_role(target_household_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.households h
      where h.id = target_household_id
        and h.deleted_at is null
        and h.owner_user_id = auth.uid()
    ) then 'owner'
    else (
      select hm.role
      from public.household_members hm
      where hm.household_id = target_household_id
        and hm.deleted_at is null
        and hm.user_id = auth.uid()
      order by case hm.role
        when 'owner' then 1
        when 'co_owner' then 2
        when 'editor' then 3
        when 'viewer' then 4
        when 'maintenance_guest' then 5
        when 'buyer_preview' then 6
        when 'insurance_view' then 7
        else 99
      end
      limit 1
    )
  end;
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_household_role(target_household_id) is not null;
$$;

create or replace function public.is_household_editor(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_household_role(target_household_id) in ('owner','co_owner','editor');
$$;

create or replace function public.can_manage_household_members(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_household_role(target_household_id) in ('owner','co_owner');
$$;

-- Ownership guards.
create or replace function public.guard_property_owner_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.owner_user_id is distinct from new.owner_user_id and auth.role() <> 'service_role' then
    raise exception 'owner_user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists properties_guard_owner_user_id on public.properties;
create trigger properties_guard_owner_user_id
before update on public.properties
for each row execute function public.guard_property_owner_user_id();

create or replace function public.guard_property_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    old.property_id is distinct from new.property_id
    or old.user_id is distinct from new.user_id
  ) then
    raise exception 'membership identity cannot be changed';
  end if;

  if tg_op in ('INSERT','UPDATE')
    and new.role in ('owner','co_owner')
    and coalesce(current_setting('app.accepting_property_invitation', true), '') <> 'on'
    and not public.is_property_owner(new.property_id) then
    raise exception 'only owners can grant owner or co-owner access';
  end if;

  if tg_op = 'UPDATE' and old.role in ('owner','co_owner') and new.role not in ('owner','co_owner') and not public.is_property_owner(old.property_id) then
    raise exception 'only owners can downgrade owner or co-owner access';
  end if;

  if tg_op = 'DELETE' and old.role in ('owner','co_owner') and not public.is_property_owner(old.property_id) then
    raise exception 'only owners can remove owner or co-owner access';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists property_members_guard_role on public.property_members;
create trigger property_members_guard_role
before insert or update or delete on public.property_members
for each row execute function public.guard_property_member_role();

create or replace function public.guard_household_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    old.household_id is distinct from new.household_id
    or old.user_id is distinct from new.user_id
  ) then
    raise exception 'membership identity cannot be changed';
  end if;

  if tg_op in ('INSERT','UPDATE') and new.role in ('owner','co_owner') and public.current_household_role(new.household_id) <> 'owner' then
    raise exception 'only household owners can grant owner or co-owner access';
  end if;

  if tg_op = 'UPDATE' and old.role in ('owner','co_owner') and new.role not in ('owner','co_owner') and public.current_household_role(old.household_id) <> 'owner' then
    raise exception 'only household owners can downgrade owner or co-owner access';
  end if;

  if tg_op = 'DELETE' and old.role in ('owner','co_owner') and public.current_household_role(old.household_id) <> 'owner' then
    raise exception 'only household owners can remove owner or co-owner access';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_guard_role on public.household_members;
create trigger household_members_guard_role
before insert or update or delete on public.household_members
for each row execute function public.guard_household_member_role();

-- RLS policy replacement.
drop policy if exists p6a_households_select_member on public.households;
drop policy if exists p6d_households_select_member on public.households;
drop policy if exists p10_households_select_member on public.households;
create policy p10_households_select_member on public.households
for select using (public.is_household_member(id) and deleted_at is null);

drop policy if exists p6a_households_insert_owner on public.households;
drop policy if exists p6d_households_insert_owner on public.households;
drop policy if exists p10_households_insert_owner on public.households;
create policy p10_households_insert_owner on public.households
for insert with check (owner_user_id = auth.uid());

drop policy if exists p6a_households_update_editor on public.households;
drop policy if exists p6d_households_update_editor on public.households;
drop policy if exists p10_households_update_editor on public.households;
create policy p10_households_update_editor on public.households
for update using (public.is_household_editor(id)) with check (public.is_household_editor(id));

drop policy if exists p6a_households_delete_owner on public.households;
drop policy if exists p6d_households_delete_owner on public.households;
drop policy if exists p10_households_delete_owner on public.households;
create policy p10_households_delete_owner on public.households
for delete using (public.current_household_role(id) = 'owner');

drop policy if exists p6a_household_members_select_member on public.household_members;
drop policy if exists p6d_household_members_select_member on public.household_members;
drop policy if exists p10_household_members_select_member on public.household_members;
create policy p10_household_members_select_member on public.household_members
for select using (public.is_household_member(household_id) and deleted_at is null);

drop policy if exists p6a_household_members_insert_editor on public.household_members;
drop policy if exists p6d_household_members_insert_editor on public.household_members;
drop policy if exists p10_household_members_insert_manager on public.household_members;
create policy p10_household_members_insert_manager on public.household_members
for insert with check (public.can_manage_household_members(household_id));

drop policy if exists p6a_household_members_update_editor on public.household_members;
drop policy if exists p6d_household_members_update_editor on public.household_members;
drop policy if exists p10_household_members_update_manager on public.household_members;
create policy p10_household_members_update_manager on public.household_members
for update using (public.can_manage_household_members(household_id))
with check (public.can_manage_household_members(household_id));

drop policy if exists p6a_household_members_delete_editor on public.household_members;
drop policy if exists p6d_household_members_delete_editor on public.household_members;
drop policy if exists p10_household_members_delete_manager on public.household_members;
create policy p10_household_members_delete_manager on public.household_members
for delete using (public.can_manage_household_members(household_id));

drop policy if exists p6a_properties_select_member on public.properties;
drop policy if exists p10_properties_select_member on public.properties;
create policy p10_properties_select_member on public.properties
for select using (public.is_property_member(id) and deleted_at is null);

drop policy if exists p6a_properties_insert_owner on public.properties;
drop policy if exists p10_properties_insert_owner on public.properties;
create policy p10_properties_insert_owner on public.properties
for insert with check (owner_user_id = auth.uid());

drop policy if exists p6a_properties_update_editor on public.properties;
drop policy if exists p10_properties_update_editor on public.properties;
create policy p10_properties_update_editor on public.properties
for update using (public.is_property_editor(id)) with check (public.is_property_editor(id));

drop policy if exists p6a_properties_delete_editor on public.properties;
drop policy if exists p10_properties_delete_owner on public.properties;
create policy p10_properties_delete_owner on public.properties
for delete using (public.is_property_owner_or_co_owner(id));

drop policy if exists p6a_property_members_select_member on public.property_members;
drop policy if exists p10_property_members_select_member on public.property_members;
create policy p10_property_members_select_member on public.property_members
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6a_property_members_insert_editor on public.property_members;
drop policy if exists p10_property_members_insert_manager on public.property_members;
create policy p10_property_members_insert_manager on public.property_members
for insert with check (public.can_manage_property_members(property_id));

drop policy if exists p6a_property_members_update_editor on public.property_members;
drop policy if exists p10_property_members_update_manager on public.property_members;
create policy p10_property_members_update_manager on public.property_members
for update using (public.can_manage_property_members(property_id))
with check (public.can_manage_property_members(property_id));

drop policy if exists p6a_property_members_delete_editor on public.property_members;
drop policy if exists p10_property_members_delete_manager on public.property_members;
create policy p10_property_members_delete_manager on public.property_members
for delete using (public.can_manage_property_members(property_id));

drop policy if exists p6a_floors_select on public.floors;
drop policy if exists p10_floors_select on public.floors;
create policy p10_floors_select on public.floors
for select using (public.is_property_member(property_id) and deleted_at is null);
drop policy if exists p6a_floors_insert on public.floors;
drop policy if exists p10_floors_insert on public.floors;
create policy p10_floors_insert on public.floors
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_floors_update on public.floors;
drop policy if exists p10_floors_update on public.floors;
create policy p10_floors_update on public.floors
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_floors_delete on public.floors;
drop policy if exists p10_floors_delete on public.floors;
create policy p10_floors_delete on public.floors
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_rooms_select on public.rooms;
drop policy if exists p10_rooms_select on public.rooms;
create policy p10_rooms_select on public.rooms
for select using (public.is_property_member(property_id) and deleted_at is null);
drop policy if exists p6a_rooms_insert on public.rooms;
drop policy if exists p10_rooms_insert on public.rooms;
create policy p10_rooms_insert on public.rooms
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_rooms_update on public.rooms;
drop policy if exists p10_rooms_update on public.rooms;
create policy p10_rooms_update on public.rooms
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_rooms_delete on public.rooms;
drop policy if exists p10_rooms_delete on public.rooms;
create policy p10_rooms_delete on public.rooms
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_utilities_select on public.utilities;
drop policy if exists p10_utilities_select on public.utilities;
create policy p10_utilities_select on public.utilities
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_utilities_insert on public.utilities;
drop policy if exists p10_utilities_insert on public.utilities;
create policy p10_utilities_insert on public.utilities
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_utilities_update on public.utilities;
drop policy if exists p10_utilities_update on public.utilities;
create policy p10_utilities_update on public.utilities
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_utilities_delete on public.utilities;
drop policy if exists p10_utilities_delete on public.utilities;
create policy p10_utilities_delete on public.utilities
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_systems_select on public.systems;
drop policy if exists p10_systems_select on public.systems;
create policy p10_systems_select on public.systems
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_systems_insert on public.systems;
drop policy if exists p10_systems_insert on public.systems;
create policy p10_systems_insert on public.systems
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_systems_update on public.systems;
drop policy if exists p10_systems_update on public.systems;
create policy p10_systems_update on public.systems
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_systems_delete on public.systems;
drop policy if exists p10_systems_delete on public.systems;
create policy p10_systems_delete on public.systems
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_assets_select on public.assets;
drop policy if exists p10_assets_select on public.assets;
create policy p10_assets_select on public.assets
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_assets_insert on public.assets;
drop policy if exists p10_assets_insert on public.assets;
create policy p10_assets_insert on public.assets
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_assets_update on public.assets;
drop policy if exists p10_assets_update on public.assets;
create policy p10_assets_update on public.assets
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_assets_delete on public.assets;
drop policy if exists p10_assets_delete on public.assets;
create policy p10_assets_delete on public.assets
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_reminders_select on public.reminders;
drop policy if exists p10_reminders_select on public.reminders;
create policy p10_reminders_select on public.reminders
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_reminders_insert on public.reminders;
drop policy if exists p10_reminders_insert on public.reminders;
create policy p10_reminders_insert on public.reminders
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_reminders_update on public.reminders;
drop policy if exists p10_reminders_update on public.reminders;
create policy p10_reminders_update on public.reminders
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_reminders_delete on public.reminders;
drop policy if exists p10_reminders_delete on public.reminders;
create policy p10_reminders_delete on public.reminders
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_service_records_select on public.service_records;
drop policy if exists p6f_service_records_select on public.service_records;
drop policy if exists p10_service_records_select on public.service_records;
create policy p10_service_records_select on public.service_records
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_service_records_insert on public.service_records;
drop policy if exists p6f_service_records_insert on public.service_records;
drop policy if exists p10_service_records_insert on public.service_records;
create policy p10_service_records_insert on public.service_records
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_service_records_update on public.service_records;
drop policy if exists p6f_service_records_update on public.service_records;
drop policy if exists p10_service_records_update on public.service_records;
create policy p10_service_records_update on public.service_records
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_service_records_delete on public.service_records;
drop policy if exists p6f_service_records_delete on public.service_records;
drop policy if exists p10_service_records_delete on public.service_records;
create policy p10_service_records_delete on public.service_records
for delete using (public.is_property_editor(property_id));

drop policy if exists p6a_issues_select on public.issues;
drop policy if exists p6g_issues_select on public.issues;
drop policy if exists p10_issues_select on public.issues;
create policy p10_issues_select on public.issues
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6a_issues_insert on public.issues;
drop policy if exists p6g_issues_insert on public.issues;
drop policy if exists p10_issues_insert on public.issues;
create policy p10_issues_insert on public.issues
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6a_issues_update on public.issues;
drop policy if exists p6g_issues_update on public.issues;
drop policy if exists p10_issues_update on public.issues;
create policy p10_issues_update on public.issues
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p6a_issues_delete on public.issues;
drop policy if exists p6g_issues_delete on public.issues;
drop policy if exists p10_issues_delete on public.issues;
create policy p10_issues_delete on public.issues
for delete using (public.is_property_editor(property_id));

drop policy if exists p6f_repairs_select on public.repairs;
drop policy if exists p10_repairs_select on public.repairs;
create policy p10_repairs_select on public.repairs
for select using (public.is_property_member(property_id) and deleted_at is null);
drop policy if exists p6f_repairs_insert on public.repairs;
drop policy if exists p10_repairs_insert on public.repairs;
create policy p10_repairs_insert on public.repairs
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6f_repairs_update on public.repairs;
drop policy if exists p10_repairs_update on public.repairs;
create policy p10_repairs_update on public.repairs
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p10_repairs_delete on public.repairs;
create policy p10_repairs_delete on public.repairs
for delete using (public.is_property_editor(property_id));

drop policy if exists p6g_trend_flags_select on public.trend_flags;
drop policy if exists p10_trend_flags_select on public.trend_flags;
create policy p10_trend_flags_select on public.trend_flags
for select using (public.is_property_member(property_id) and deleted_at is null);
drop policy if exists p6g_trend_flags_insert on public.trend_flags;
drop policy if exists p10_trend_flags_insert on public.trend_flags;
create policy p10_trend_flags_insert on public.trend_flags
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());
drop policy if exists p6g_trend_flags_update on public.trend_flags;
drop policy if exists p10_trend_flags_update on public.trend_flags;
create policy p10_trend_flags_update on public.trend_flags
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));
drop policy if exists p10_trend_flags_delete on public.trend_flags;
create policy p10_trend_flags_delete on public.trend_flags
for delete using (public.is_property_editor(property_id));

drop policy if exists p6i_documents_select on public.documents;
drop policy if exists p10_documents_select on public.documents;
create policy p10_documents_select on public.documents
for select using (public.can_read_property_row(property_id, visibility, visibility_contexts, created_by) and deleted_at is null);
drop policy if exists p6i_documents_insert on public.documents;
drop policy if exists p10_documents_insert on public.documents;
create policy p10_documents_insert on public.documents
for insert with check (
  public.can_write_property_documents(property_id)
  and bucket_name = 'home-documents'
  and created_by = auth.uid()
);
drop policy if exists p6i_documents_update on public.documents;
drop policy if exists p10_documents_update on public.documents;
create policy p10_documents_update on public.documents
for update using (public.can_write_property_documents(property_id))
with check (public.can_write_property_documents(property_id) and bucket_name = 'home-documents');
drop policy if exists p6i_documents_delete on public.documents;
drop policy if exists p10_documents_delete on public.documents;
create policy p10_documents_delete on public.documents
for delete using (public.can_write_property_documents(property_id));

drop policy if exists p6j_receipts_select on public.receipts;
drop policy if exists p10_receipts_select on public.receipts;
create policy p10_receipts_select on public.receipts
for select using (
  deleted_at is null
  and public.current_property_role(property_id) in ('owner','co_owner','editor','viewer','insurance_view')
);
drop policy if exists p6j_receipts_insert on public.receipts;
drop policy if exists p10_receipts_insert on public.receipts;
create policy p10_receipts_insert on public.receipts
for insert with check (
  public.is_property_editor(property_id)
  and created_by = auth.uid()
  and approved_by = auth.uid()
  and approval_status = 'approved'
  and source in ('manual_entry','manual_review')
);
drop policy if exists p6j_receipts_update on public.receipts;
drop policy if exists p10_receipts_update on public.receipts;
create policy p10_receipts_update on public.receipts
for update using (public.is_property_editor(property_id))
with check (public.is_property_editor(property_id));
drop policy if exists p6j_receipts_delete on public.receipts;
drop policy if exists p10_receipts_delete on public.receipts;
create policy p10_receipts_delete on public.receipts
for delete using (public.is_property_editor(property_id));

drop policy if exists p6i_home_documents_select on storage.objects;
drop policy if exists p10_home_documents_select on storage.objects;
create policy p10_home_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'home-documents'
  and exists (
    select 1
    from public.documents d
    where d.bucket_name = bucket_id
      and d.file_path = name
      and d.deleted_at is null
      and public.can_read_property_row(d.property_id, d.visibility, d.visibility_contexts, d.created_by)
  )
);

drop policy if exists p6i_home_documents_insert on storage.objects;
drop policy if exists p10_home_documents_insert on storage.objects;
create policy p10_home_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);

drop policy if exists p6i_home_documents_update on storage.objects;
drop policy if exists p10_home_documents_update on storage.objects;
create policy p10_home_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'home-documents'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
)
with check (
  bucket_id = 'home-documents'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);

drop policy if exists p6i_home_documents_delete on storage.objects;
drop policy if exists p10_home_documents_delete on storage.objects;
create policy p10_home_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'home-documents'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);

-- Invitation-backed sharing. Raw tokens are returned once by the create RPC;
-- only SHA-256 hashes are stored.
create table if not exists public.property_invitations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text,
  role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint property_invitations_role_check
    check (role in ('co_owner','editor','viewer','maintenance_guest','buyer_preview','insurance_view'))
);

drop trigger if exists property_invitations_set_updated_at on public.property_invitations;
create trigger property_invitations_set_updated_at
before update on public.property_invitations
for each row execute function public.set_updated_at();

alter table public.property_invitations enable row level security;

drop policy if exists p10_property_invitations_select_manager on public.property_invitations;
create policy p10_property_invitations_select_manager on public.property_invitations
for select using (
  public.can_manage_property_members(property_id)
  or accepted_by = auth.uid()
);

drop policy if exists p10_property_invitations_insert_manager on public.property_invitations;
create policy p10_property_invitations_insert_manager on public.property_invitations
for insert with check (
  public.can_manage_property_members(property_id)
  and inviter_user_id = auth.uid()
);

drop policy if exists p10_property_invitations_update_manager on public.property_invitations;
create policy p10_property_invitations_update_manager on public.property_invitations
for update using (
  public.can_manage_property_members(property_id)
  or accepted_by = auth.uid()
)
with check (
  public.can_manage_property_members(property_id)
  or accepted_by = auth.uid()
);

drop policy if exists p10_property_invitations_delete_manager on public.property_invitations;
create policy p10_property_invitations_delete_manager on public.property_invitations
for delete using (public.can_manage_property_members(property_id));

create index if not exists property_invitations_property_idx
on public.property_invitations (property_id, created_at desc)
where deleted_at is null;

create index if not exists property_invitations_active_token_idx
on public.property_invitations (token_hash)
where accepted_at is null and revoked_at is null and deleted_at is null;

create or replace function public.create_property_invitation(
  target_property_id uuid,
  target_invited_email text,
  target_role text,
  target_expires_in_seconds integer default 604800
)
returns table(invitation_id uuid, invite_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_token text;
  generated_hash text;
  inserted_id uuid;
  inserted_expires_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if not public.can_manage_property_members(target_property_id) then
    raise exception 'only owners and co-owners can invite property members';
  end if;

  if target_role not in ('co_owner','editor','viewer','maintenance_guest','buyer_preview','insurance_view') then
    raise exception 'unsupported invitation role';
  end if;

  generated_token := encode(extensions.gen_random_bytes(32), 'hex');
  generated_hash := encode(extensions.digest(generated_token, 'sha256'), 'hex');
  inserted_expires_at := now() + make_interval(secs => greatest(300, least(coalesce(target_expires_in_seconds, 604800), 2592000)));

  insert into public.property_invitations (
    property_id,
    inviter_user_id,
    invited_email,
    role,
    token_hash,
    expires_at
  )
  values (
    target_property_id,
    auth.uid(),
    nullif(lower(trim(target_invited_email)), ''),
    target_role,
    generated_hash,
    inserted_expires_at
  )
  returning id into inserted_id;

  invitation_id := inserted_id;
  invite_token := generated_token;
  expires_at := inserted_expires_at;
  return next;
end;
$$;

create or replace function public.accept_property_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.property_invitations%rowtype;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select *
  into invitation
  from public.property_invitations pi
  where pi.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
    and pi.accepted_at is null
    and pi.revoked_at is null
    and pi.deleted_at is null
    and pi.expires_at > now()
  limit 1;

  if invitation.id is null then
    raise exception 'invitation is invalid, expired, or already used';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = auth.uid();

  if invitation.invited_email is not null and invitation.invited_email <> coalesce(current_email, '') then
    raise exception 'this invitation is for a different email address';
  end if;

  perform set_config('app.accepting_property_invitation', 'on', true);

  insert into public.property_members (property_id, user_id, role, deleted_at)
  values (invitation.property_id, auth.uid(), invitation.role, null)
  on conflict (property_id, user_id)
  do update set
    role = excluded.role,
    deleted_at = null,
    updated_at = now();

  update public.property_invitations
  set accepted_at = now(),
      accepted_by = auth.uid(),
      updated_at = now()
  where id = invitation.id;

  return invitation.property_id;
end;
$$;

-- Race guards. If legacy duplicates already exist in a hosted database, skip
-- index creation and let the data be cleaned manually before re-running.
do $$
begin
  if not exists (
    select 1
    from public.households
    where deleted_at is null
    group by owner_user_id
    having count(*) > 1
  ) then
    create unique index if not exists households_owner_active_unique_idx
    on public.households (owner_user_id)
    where deleted_at is null;
  else
    raise notice 'Skipped households_owner_active_unique_idx because duplicates exist.';
  end if;

  if not exists (
    select 1
    from public.floors
    where deleted_at is null
    group by property_id, lower(trim(name))
    having count(*) > 1
  ) then
    create unique index if not exists floors_property_name_active_unique_idx
    on public.floors (property_id, lower(trim(name)))
    where deleted_at is null;
  else
    raise notice 'Skipped floors_property_name_active_unique_idx because duplicates exist.';
  end if;

  if not exists (
    select 1
    from public.rooms
    where deleted_at is null
    group by property_id, coalesce(floor_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)), room_type
    having count(*) > 1
  ) then
    create unique index if not exists rooms_property_floor_name_type_active_unique_idx
    on public.rooms (
      property_id,
      coalesce(floor_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(name)),
      room_type
    )
    where deleted_at is null;
  else
    raise notice 'Skipped rooms_property_floor_name_type_active_unique_idx because duplicates exist.';
  end if;
end $$;

notify pgrst, 'reload schema';
