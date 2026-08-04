-- 034: re-apply the 019 sweep over the trigger functions added by 033.
--
-- 019 revoked EXECUTE from every trigger-returning function in public so none
-- of them is reachable as a /rest/v1/rpc endpoint. That sweep ran once, so the
-- five trigger functions introduced by 033 (guard_household_owner_user_id,
-- guard_property_household_membership, guard_completed_condition_report,
-- guard_completed_condition_report_entry, sync_profile_email) were created
-- afterwards with Supabase's default grants and showed up as anon-callable in
-- the security advisor.
--
-- As in 019: the trigger mechanism does not check EXECUTE on a trigger
-- function, so this removes an unnecessary call surface without weakening any
-- enforcement. Idempotent and re-runnable — it re-sweeps every trigger
-- function rather than naming the new five, so a future migration that adds
-- one is covered the next time this runs.

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
