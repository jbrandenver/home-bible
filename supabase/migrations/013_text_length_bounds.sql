-- SECURITY / COST HARDENING (audit 2026-07-22): text columns were unbounded.
--
-- Writes reach the DB directly from the browser via supabase-js under RLS, so
-- the Zod .max() caps in packages/shared are only the client-path guard — a
-- caller using the anon key + their JWT can bypass them and store multi-MB
-- strings in their own property's text columns, inflating storage/egress
-- (see docs/COST_GOVERNANCE.md). This adds a DB-level ceiling that survives the
-- client being bypassed.
--
-- Approach: a generous uniform cap on every text column of every base table in
-- `public`. 50k characters is far above any legitimate note/description/URL/
-- hash/path in this schema, but kills the multi-megabyte abuse vector. Added
-- NOT VALID so the migration can never fail on a pre-existing row; the CHECK is
-- still enforced on every INSERT/UPDATE from now on. Idempotent: re-running
-- skips columns that already have their bound.

do $$
declare
  col record;
  cons_name text;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying')
  loop
    cons_name := left(col.table_name || '_' || col.column_name || '_maxlen', 63);
    if not exists (
      select 1 from pg_constraint where conname = cons_name
    ) then
      execute format(
        'alter table public.%I add constraint %I check (char_length(%I) <= 50000) not valid',
        col.table_name, cons_name, col.column_name
      );
    end if;
  end loop;
end $$;
