-- PERFORMANCE (launch review 2026-07-31): wrap bare auth.uid() calls in RLS
-- policies as (select auth.uid()).
--
-- Postgres re-evaluates a bare auth.uid() per ROW; the subselect form is
-- evaluated once per statement (an InitPlan) and cached. Supabase's
-- performance advisor flagged 25 policies — every one a simple equality like
-- `created_by = auth.uid()` — so the rewrite is mechanical and the semantics
-- are identical. Done as a catalog-driven loop rather than 25 hand-written
-- ALTERs so it is self-verifying: after this runs, the advisor query below
-- matches nothing, and re-running is a no-op.
--
-- Deliberately narrow: only policies whose expressions contain a bare
-- auth.uid() and no already-wrapped `SELECT auth` form. ALTER POLICY only
-- accepts the clauses the policy already has (USING for reads, WITH CHECK
-- for inserts), which the null checks below respect.

do $$
declare
  p record;
  sqltext text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
      and coalesce(qual, '') !~ 'SELECT auth'
      and coalesce(with_check, '') !~ 'SELECT auth'
  loop
    sqltext := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if p.qual is not null then
      sqltext := sqltext || format(' using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if p.with_check is not null then
      sqltext := sqltext || format(' with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute sqltext;
  end loop;
end $$;

notify pgrst, 'reload schema';
