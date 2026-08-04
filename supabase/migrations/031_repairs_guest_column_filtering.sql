-- 031: contractor contacts and costs become a database guarantee.
--
-- Guest-class roles (maintenance_guest, buyer_preview, insurance_view) were
-- only ever filtered out of contractor names/numbers and costs in client-side
-- JavaScript — any guest with an API client could read them. Column-level
-- privileges cannot vary by a caller's per-property role, so the pattern is:
-- remove the sensitive columns from what `authenticated` can SELECT at all,
-- and hand the full-household roles a SECURITY DEFINER function that returns
-- them with a role check inside.
--
-- Postgres gotcha this migration learned the hard way: `REVOKE SELECT (col)`
-- is a NO-OP while the role holds a table-level SELECT grant — column revokes
-- only subtract column-level grants. Enforcement therefore revokes the
-- table-level SELECT outright and re-grants column-by-column, every column
-- except the five sensitive ones (filters in WHERE need SELECT privilege on
-- the filtered column, so automation_device_id etc. must stay granted).
--
-- Full household (owner, co_owner, editor, viewer): unchanged experience via
-- the RPC merge in lib/repairs.ts. Guests: the fields read as "not recorded"
-- — now enforced by Postgres, not JavaScript.

revoke select on public.repairs from authenticated, anon;

grant select (
  id, property_id, room_id, asset_id, utility_id, title, description,
  repair_type, status, priority, reported_date, completed_date, notes,
  created_at, updated_at, deleted_at, automation_device_id,
  automation_hub_id, scheduled_date, scheduled_window, created_by
) on public.repairs to authenticated;

create or replace function public.get_repairs_private_fields(p_repair_ids uuid[])
returns table (
  repair_id uuid,
  contractor_name text,
  contractor_phone text,
  contractor_email text,
  estimated_cost numeric,
  actual_cost numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.contractor_name, r.contractor_phone, r.contractor_email,
         r.estimated_cost, r.actual_cost
  from public.repairs r
  where r.id = any(p_repair_ids)
    and r.deleted_at is null
    and public.current_property_role(r.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_repairs_private_fields(uuid[]) from public, anon;
grant execute on function public.get_repairs_private_fields(uuid[]) to authenticated;
