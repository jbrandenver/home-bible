-- Correct the guest-role read scope to match the product's own role contracts
-- (audit 2026-07-29, finding SEC-3 — refined).
--
-- 015 tightened rooms/floors/repairs/trend_flags/automation_* from bare
-- is_property_member to a trusted-roles-only check. That was right for the
-- automation tables and trend flags, but too blunt for the rest: the role
-- definitions in apps/web/lib/sharing.ts explicitly promise
--   * maintenance_guest -> "Relevant assets, reminders, repairs, service
--     history, and issues" and "Open repair and service context",
--     while hiding the "Whole-home room archive";
--   * buyer_preview     -> "Rooms, utilities, assets, warranties, repairs,
--     service history, issues, and file details";
--   * insurance_view    -> "Repairs and service history".
-- Blocking repairs outright, and rooms for buyers, would have broken the very
-- sharing experience the app advertises.
--
-- Scope now applied:
--   rooms, floors  -> everyone EXCEPT maintenance_guest (the room archive)
--   repairs        -> all member roles (all three guest roles are promised it)
--   trend_flags    -> trusted roles only (internal analysis; promised to nobody)
--   automation_*   -> trusted roles only (SSIDs, gateway/VLAN notes, credential
--                     references, recovery instructions, MAC addresses)

-- Everyone with a seat except the maintenance guest, who is scoped to the
-- specific systems they were called out for rather than the whole house.
create or replace function public.can_read_property_room_archive(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_property_role(target_property_id)
    in ('owner','co_owner','editor','viewer','buyer_preview','insurance_view');
$$;

drop policy if exists p10_rooms_select on public.rooms;
create policy p10_rooms_select on public.rooms
for select using (public.can_read_property_room_archive(property_id) and deleted_at is null);

drop policy if exists p10_floors_select on public.floors;
create policy p10_floors_select on public.floors
for select using (public.can_read_property_room_archive(property_id) and deleted_at is null);

-- Repairs carry the service context every guest role is promised. Note that
-- contractor contact details, costs and private notes are still filtered only
-- on the client (restrictMaintenanceData in apps/web/lib/sharing.ts). Making
-- that a database guarantee needs a column-filtered view or a reader function,
-- because Postgres column privileges are per-database-role and cannot vary by
-- a caller's per-property role. Tracked as follow-up work, not closed here.
drop policy if exists p10_repairs_select on public.repairs;
create policy p10_repairs_select on public.repairs
for select using (public.is_property_member(property_id) and deleted_at is null);

revoke execute on function public.can_read_property_room_archive(uuid) from anon;

notify pgrst, 'reload schema';
