-- Recall monitoring: matches from the free, keyless CPSC Recall API against
-- the user's asset registry (docs/THREAT_MITIGATION.md, T4 build item 2).
--
-- The check-recalls Edge Function runs on a daily schedule with the service
-- role, matches recalls conservatively against asset brand/model, and writes
-- rows here. Users read them and may dismiss them; they never write them.
--
-- WHY USERS CANNOT INSERT OR DELETE (same stance as 022_entitlements.sql):
-- a recall match is a safety notice produced by the matcher, not user content.
-- An INSERT policy would let any member fabricate "official" recall notices on
-- a shared property — a convincing phishing surface ("your furnace is recalled,
-- call this number"). DELETE would let a row vanish without the audit trail a
-- dismissal leaves. So: SELECT for trusted members, UPDATE for editors (to
-- dismiss), and no INSERT/DELETE policy at all — RLS denies by default — plus
-- an explicit grant revocation so a future well-meaning `for all using (true)`
-- added during debugging cannot quietly open it. The service role bypasses RLS.

create table if not exists public.recall_matches (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  asset_id       uuid not null references public.assets(id) on delete cascade,
  recall_number  text not null,
  title          text,
  hazard         text,
  remedy         text,
  recall_url     text,
  -- What string actually matched (e.g. 'model WF45T6000A'), shown to the user
  -- so a match is never a black box.
  matched_on     text,
  status         text not null default 'open'
                   check (status in ('open','dismissed')),
  source         text not null default 'cpsc',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- One row per (asset, recall). The Edge Function inserts with
-- ON CONFLICT DO NOTHING against this index, so a match the user has already
-- dismissed is never resurrected to 'open' by the next cron run.
create unique index if not exists recall_matches_asset_recall_uidx
  on public.recall_matches (asset_id, recall_number);

create index if not exists recall_matches_property_idx
  on public.recall_matches (property_id)
  where deleted_at is null;

alter table public.recall_matches enable row level security;

drop policy if exists p11_recall_matches_select on public.recall_matches;
create policy p11_recall_matches_select on public.recall_matches
for select using (public.is_trusted_property_member(property_id) and deleted_at is null);

-- Editors may dismiss (status -> 'dismissed'). The status check constraint
-- bounds what an UPDATE can do to the row's meaning.
drop policy if exists p11_recall_matches_update on public.recall_matches;
create policy p11_recall_matches_update on public.recall_matches
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

-- Deliberately no insert / delete policy. See the header.
revoke insert, delete on public.recall_matches from anon, authenticated;

drop trigger if exists recall_matches_set_updated_at on public.recall_matches;
create trigger recall_matches_set_updated_at
before update on public.recall_matches
for each row execute function public.set_updated_at();

-- Text bounds, following 013's naming convention (tablename_columnname_maxlen).
-- Explicit per-column instead of re-running 013's generic generator; NOT VALID
-- so existing rows are never scanned on apply.
do $$
declare
  col text;
  cons_name text;
begin
  foreach col in array array[
    'recall_number', 'title', 'hazard', 'remedy', 'recall_url', 'matched_on', 'status', 'source'
  ]
  loop
    cons_name := 'recall_matches_' || col || '_maxlen';
    if not exists (select 1 from pg_constraint where conname = cons_name) then
      execute format(
        'alter table public.recall_matches add constraint %I check (char_length(%I) <= 50000) not valid',
        cons_name, col
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
