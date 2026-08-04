-- 036: re-run the 019/034 trigger-function sweep for 035, and pin a search_path.
--
-- Two live security-advisor findings, both introduced by 035:
--
-- 1. `enforce_property_allowance()` — the BEFORE INSERT trigger that enforces
--    the property allowance — was created after 034's sweep had already run, so
--    it picked up Supabase's default grants and became callable by `anon` and
--    `authenticated` at /rest/v1/rpc/enforce_property_allowance. Calling a
--    trigger function directly errors out, so this was call surface rather than
--    a hole, but it is exactly the regression 034 was written to prevent and it
--    keeps the advisor noisy enough to hide a real finding later.
--
-- 2. `free_property_allowance()` — the IMMUTABLE `select 2` that mirrors
--    FREE_PROPERTY_ALLOWANCE — was created without `set search_path`. It
--    references nothing, so nothing can be shadowed, but every other function
--    in this schema pins it and the linter is right to want consistency.
--
-- As in 019 and 034: the trigger mechanism does not check EXECUTE on a trigger
-- function, so revoking it removes call surface without weakening enforcement.
-- The sweep is idempotent and re-runnable — it covers every trigger function
-- rather than naming the new one.
--
-- STANDING RULE: any future migration that creates a function returning
-- `trigger` must end by re-running this same sweep, or the advisor will flag it.

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

alter function public.free_property_allowance() set search_path = '';
