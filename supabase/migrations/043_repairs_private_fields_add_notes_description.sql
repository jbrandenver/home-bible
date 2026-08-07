-- 043: get_repairs_private_fields learns to return description and notes.
--
-- Part one of two. This half is deploy-safe and additive: it only widens what
-- the RPC returns. Old clients that never ask for the new fields are
-- unaffected; new clients get them. Nothing is revoked here.
--
-- 044 does the actual revoke, and MUST NOT be applied until the client code
-- that stops selecting these columns is live. See the header of 044 for why
-- the order is load-bearing.

-- Adding columns to the returned table requires dropping first —
-- `create or replace function` cannot change a return type.
drop function if exists public.get_repairs_private_fields(uuid[]);

create or replace function public.get_repairs_private_fields(p_repair_ids uuid[])
returns table (
  repair_id uuid,
  contractor_name text,
  contractor_phone text,
  contractor_email text,
  estimated_cost numeric,
  actual_cost numeric,
  description text,
  notes text
)
language sql
stable
security definer
-- Pinned to the empty search_path (031 used `public`), with every reference
-- schema-qualified. Continues the hardening 036 started.
set search_path = ''
as $$
  select r.id, r.contractor_name, r.contractor_phone, r.contractor_email,
         r.estimated_cost, r.actual_cost, r.description, r.notes
  from public.repairs r
  where r.id = any(p_repair_ids)
    and r.deleted_at is null
    and public.current_property_role(r.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_repairs_private_fields(uuid[]) from public, anon;
grant execute on function public.get_repairs_private_fields(uuid[]) to authenticated;
