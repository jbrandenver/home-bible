-- 029: archive a property without deleting it.
--
-- Launch QA 2026-08-03: the portfolio needed a way to set a home aside
-- (sold, between tenants, wound down) without destroying its record.
-- Archived properties disappear from the switcher and active lists but keep
-- every row; after a retention window (90 days, enforced app-side on
-- portfolio load) they are soft-deleted like any other removal. Billing is
-- unchanged by archiving — only deletion downgrades, at the next cycle.

alter table public.properties
  add column if not exists archived_at timestamptz;

create index if not exists properties_archived_at_idx
  on public.properties(archived_at)
  where archived_at is not null;
