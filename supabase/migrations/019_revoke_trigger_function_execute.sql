-- Remove the last direct-call surface on trigger-only functions
-- (audit 2026-07-29, SEC-6 follow-up).
--
-- 018 revoked EXECUTE from PUBLIC and anon, which was enough to close anonymous
-- access. It did not close `authenticated`, because Supabase's default
-- privileges grant EXECUTE on new public functions to authenticated explicitly
-- rather than via PUBLIC — so the revoke had nothing to remove.
--
-- These functions are invoked by the trigger mechanism, which does not check
-- EXECUTE on the trigger function. Removing the grant therefore has no effect
-- on enforcement; it only stops them being callable as /rest/v1/rpc endpoints.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('revoke all on function %s from anon', f.sig);
    execute format('revoke all on function %s from authenticated', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
