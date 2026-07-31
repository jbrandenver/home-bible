-- Stop exposing internal helpers on the public REST RPC surface
-- (audit 2026-07-29, SEC-6) and pin the last mutable search_path.
--
-- 015 revoked EXECUTE from `anon`, which did nothing: Postgres grants EXECUTE
-- to PUBLIC by default and `anon` inherits it. The grant has to be removed from
-- PUBLIC and then handed back only where it is genuinely required.
--
-- Two categories, treated differently:
--   * RLS helpers  — evaluated inside policy expressions as the *calling* role,
--     so `authenticated` must keep EXECUTE or every signed-in query fails with
--     "permission denied for function". Revoked from PUBLIC/anon only.
--   * Trigger guards — invoked by the trigger mechanism, which does not check
--     EXECUTE. Nobody needs a direct grant, so they lose it entirely.

-- Trigger function that escaped the search_path pinning applied elsewhere.
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare
  f record;
  -- Called from RLS policy expressions: signed-in users must retain EXECUTE.
  policy_helpers text[] := array[
    'is_property_owner','is_property_owner_or_co_owner','is_property_member',
    'is_property_editor','is_trusted_property_member','can_manage_property_members',
    'current_property_role','can_read_property_row','can_read_property_documents',
    'can_write_property_documents','can_read_property_room_archive',
    'is_household_member','is_household_editor','can_manage_household_members',
    'current_household_role','document_storage_property_id'
  ];
  -- Legitimate RPCs the browser calls directly, but only when signed in.
  user_rpcs text[] := array[
    'accept_property_invitation','create_property_invitation'
  ];
  -- Trigger-only. Never called directly by anyone.
  trigger_guards text[] := array[
    'guard_property_owner_user_id','guard_property_member_role',
    'guard_household_member_role','guard_property_invitation',
    'guard_row_provenance','set_created_by','set_updated_at'
  ];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(policy_helpers || user_rpcs || trigger_guards)
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('revoke all on function %s from anon', f.sig);

    if f.proname = any(policy_helpers) or f.proname = any(user_rpcs) then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;

    -- service_role keeps access for maintenance and the delete-account path.
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
