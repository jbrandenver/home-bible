-- Portfolio foundation: units, tenancies, condition reports, compliance
-- obligations, and subscription-capable entitlements.
--
-- WHY UNITS ARE PROPERTIES. An apartment building's unit needs everything a
-- house already has here — rooms, assets with serials, paint, documents,
-- repairs, sharing, the handover report. Modelling units as a new child table
-- would mean re-parenting all of that. Instead a unit IS a property with
-- `parent_property_id` pointing at the building, so every existing table,
-- policy, guard trigger and page works per-unit with no changes. Nesting is
-- capped at one level (building -> unit, never unit -> unit) by a guard
-- trigger, and a unit always shares its building's household and owner so
-- roll-ups and RLS stay coherent.
--
-- The rest of this migration is the landlord record layer the market lacks:
--   * tenancies           — who held the unit when, and the deposit at stake.
--   * condition_reports   — timestamped move-in / move-out condition evidence
--                           (the substrate for a CA AB 2801 deposit packet:
--                           photos BEFORE tenancy, at move-out BEFORE repairs,
--                           and AFTER repairs, delivered with the itemized
--                           deduction statement).
--   * compliance_obligations — registration / license / inspection deadlines
--                           (NYC lead law, Seattle RRIO, Philadelphia rental
--                           license, MA smoke certs) with retention notes.
--
-- Access model for all three: trusted members read (owner, co_owner, editor,
-- viewer — deposits and tenancy details are none of a maintenance guest's
-- business), editors write, provenance guarded. Same helpers as 015/017.

-- 1. Units ------------------------------------------------------------------

alter table public.properties
  add column if not exists parent_property_id uuid references public.properties(id) on delete cascade,
  add column if not exists unit_label text;

create index if not exists properties_parent_idx
  on public.properties (parent_property_id)
  where deleted_at is null;

alter table public.properties drop constraint if exists properties_property_type_check;
alter table public.properties
  add constraint properties_property_type_check
  check (
    property_type in (
      'single_family_home','condo','apartment','townhome','duplex','cabin','rental_home',
      'apartment_building','multi_family'
    )
  );

-- One level of nesting, same household, same owner. Runs BEFORE INSERT OR
-- UPDATE because the properties UPDATE policy admits editors, who could
-- otherwise re-parent a record across households.
create or replace function public.guard_property_unit_nesting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.properties%rowtype;
begin
  if new.parent_property_id is null then
    return new;
  end if;

  if new.parent_property_id = new.id then
    raise exception 'a property cannot be its own parent';
  end if;

  select * into parent
  from public.properties
  where id = new.parent_property_id
    and deleted_at is null;

  if not found then
    raise exception 'parent property does not exist';
  end if;

  if parent.parent_property_id is not null then
    raise exception 'units cannot be nested inside units';
  end if;

  if parent.household_id <> new.household_id then
    raise exception 'a unit must belong to the same household as its building';
  end if;

  if parent.owner_user_id <> new.owner_user_id then
    raise exception 'a unit must share its building''s owner';
  end if;

  if exists (
    select 1 from public.properties
    where parent_property_id = new.id
      and deleted_at is null
  ) then
    raise exception 'a building with units cannot itself become a unit';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_guard_unit_nesting on public.properties;
create trigger properties_guard_unit_nesting
before insert or update on public.properties
for each row execute function public.guard_property_unit_nesting();

revoke execute on function public.guard_property_unit_nesting() from public, anon, authenticated;

-- 2. Tenancies --------------------------------------------------------------

create table if not exists public.tenancies (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties(id) on delete cascade,
  label                 text not null,
  tenant_names          text,
  start_date            date,
  end_date              date,
  deposit_amount_cents  integer check (deposit_amount_cents is null or deposit_amount_cents >= 0),
  deposit_currency      text not null default 'usd',
  deposit_returned_on   date,
  status                text not null default 'active'
                          check (status in ('upcoming','active','ended')),
  notes                 text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint tenancies_dates_ordered
    check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists tenancies_property_idx
  on public.tenancies (property_id)
  where deleted_at is null;

alter table public.tenancies enable row level security;

drop policy if exists p11_tenancies_select on public.tenancies;
create policy p11_tenancies_select on public.tenancies
for select using (public.is_trusted_property_member(property_id) and deleted_at is null);

drop policy if exists p11_tenancies_insert on public.tenancies;
create policy p11_tenancies_insert on public.tenancies
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());

drop policy if exists p11_tenancies_update on public.tenancies;
create policy p11_tenancies_update on public.tenancies
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p11_tenancies_delete on public.tenancies;
create policy p11_tenancies_delete on public.tenancies
for delete using (public.is_property_editor(property_id));

drop trigger if exists tenancies_set_updated_at on public.tenancies;
create trigger tenancies_set_updated_at
before update on public.tenancies
for each row execute function public.set_updated_at();

drop trigger if exists tenancies_set_created_by on public.tenancies;
create trigger tenancies_set_created_by before insert on public.tenancies
for each row execute function public.set_created_by();

drop trigger if exists tenancies_guard_provenance on public.tenancies;
create trigger tenancies_guard_provenance before update on public.tenancies
for each row execute function public.guard_row_provenance();

-- 3. Condition reports ------------------------------------------------------
--
-- A report is the event ("move-in walkthrough, 2026-08-01"); entries are the
-- per-room / per-area observations; photos attach through documents rows via
-- documents.condition_report_id / condition_report_entry_id below. Timestamps
-- (created_at / completed_at, never client-supplied) are the evidence value.

create table if not exists public.condition_reports (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  tenancy_id    uuid references public.tenancies(id) on delete set null,
  report_type   text not null
                  check (report_type in ('move_in','move_out','move_out_after_repairs','periodic')),
  status        text not null default 'draft'
                  check (status in ('draft','completed')),
  report_date   date not null default current_date,
  conducted_by  text,
  summary       text,
  notes         text,
  completed_at  timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists condition_reports_property_idx
  on public.condition_reports (property_id, report_date desc)
  where deleted_at is null;

create table if not exists public.condition_report_entries (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.condition_reports(id) on delete cascade,
  -- Denormalised so RLS can gate on it without a join; a guard trigger keeps
  -- it equal to the report's property_id.
  property_id       uuid not null references public.properties(id) on delete cascade,
  room_id           uuid references public.rooms(id) on delete set null,
  area_label        text,
  condition_rating  text check (condition_rating is null or condition_rating in ('good','fair','poor','damaged')),
  notes             text,
  sort_order        integer not null default 0,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index if not exists condition_report_entries_report_idx
  on public.condition_report_entries (report_id, sort_order)
  where deleted_at is null;

-- Without this, an editor on property A could attach entries to a report on
-- property B: the entry's own property_id (which RLS checks) would be A's,
-- while report_id pointed elsewhere.
create or replace function public.guard_condition_report_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_property uuid;
begin
  select property_id into report_property
  from public.condition_reports
  where id = new.report_id
    and deleted_at is null;

  if report_property is null then
    raise exception 'condition report does not exist';
  end if;

  if report_property <> new.property_id then
    raise exception 'entry property must match its report''s property';
  end if;

  return new;
end;
$$;

alter table public.condition_reports enable row level security;
alter table public.condition_report_entries enable row level security;

drop policy if exists p11_condition_reports_select on public.condition_reports;
create policy p11_condition_reports_select on public.condition_reports
for select using (public.is_trusted_property_member(property_id) and deleted_at is null);

drop policy if exists p11_condition_reports_insert on public.condition_reports;
create policy p11_condition_reports_insert on public.condition_reports
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());

drop policy if exists p11_condition_reports_update on public.condition_reports;
create policy p11_condition_reports_update on public.condition_reports
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p11_condition_reports_delete on public.condition_reports;
create policy p11_condition_reports_delete on public.condition_reports
for delete using (public.is_property_editor(property_id));

drop policy if exists p11_condition_report_entries_select on public.condition_report_entries;
create policy p11_condition_report_entries_select on public.condition_report_entries
for select using (public.is_trusted_property_member(property_id) and deleted_at is null);

drop policy if exists p11_condition_report_entries_insert on public.condition_report_entries;
create policy p11_condition_report_entries_insert on public.condition_report_entries
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());

drop policy if exists p11_condition_report_entries_update on public.condition_report_entries;
create policy p11_condition_report_entries_update on public.condition_report_entries
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p11_condition_report_entries_delete on public.condition_report_entries;
create policy p11_condition_report_entries_delete on public.condition_report_entries
for delete using (public.is_property_editor(property_id));

drop trigger if exists condition_reports_set_updated_at on public.condition_reports;
create trigger condition_reports_set_updated_at
before update on public.condition_reports
for each row execute function public.set_updated_at();

drop trigger if exists condition_reports_set_created_by on public.condition_reports;
create trigger condition_reports_set_created_by before insert on public.condition_reports
for each row execute function public.set_created_by();

drop trigger if exists condition_reports_guard_provenance on public.condition_reports;
create trigger condition_reports_guard_provenance before update on public.condition_reports
for each row execute function public.guard_row_provenance();

drop trigger if exists condition_report_entries_set_updated_at on public.condition_report_entries;
create trigger condition_report_entries_set_updated_at
before update on public.condition_report_entries
for each row execute function public.set_updated_at();

drop trigger if exists condition_report_entries_set_created_by on public.condition_report_entries;
create trigger condition_report_entries_set_created_by before insert on public.condition_report_entries
for each row execute function public.set_created_by();

drop trigger if exists condition_report_entries_guard_provenance on public.condition_report_entries;
create trigger condition_report_entries_guard_provenance before update on public.condition_report_entries
for each row execute function public.guard_row_provenance();

drop trigger if exists condition_report_entries_guard_report on public.condition_report_entries;
create trigger condition_report_entries_guard_report
before insert or update on public.condition_report_entries
for each row execute function public.guard_condition_report_entry();

revoke execute on function public.guard_condition_report_entry() from public, anon, authenticated;

-- 4. Compliance obligations -------------------------------------------------

create table if not exists public.compliance_obligations (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.properties(id) on delete cascade,
  title              text not null,
  authority          text,
  jurisdiction       text,
  obligation_type    text not null default 'other'
                       check (obligation_type in (
                         'registration','license','inspection','certification',
                         'notice','tax','insurance','other'
                       )),
  frequency_months   integer check (frequency_months is null or (frequency_months >= 1 and frequency_months <= 240)),
  next_due           date,
  last_completed_on  date,
  retention_years    integer check (retention_years is null or (retention_years >= 0 and retention_years <= 100)),
  reference_url      text,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists compliance_obligations_property_idx
  on public.compliance_obligations (property_id, next_due)
  where deleted_at is null;

alter table public.compliance_obligations enable row level security;

drop policy if exists p11_compliance_obligations_select on public.compliance_obligations;
create policy p11_compliance_obligations_select on public.compliance_obligations
for select using (public.is_trusted_property_member(property_id) and deleted_at is null);

drop policy if exists p11_compliance_obligations_insert on public.compliance_obligations;
create policy p11_compliance_obligations_insert on public.compliance_obligations
for insert with check (public.is_property_editor(property_id) and created_by = auth.uid());

drop policy if exists p11_compliance_obligations_update on public.compliance_obligations;
create policy p11_compliance_obligations_update on public.compliance_obligations
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p11_compliance_obligations_delete on public.compliance_obligations;
create policy p11_compliance_obligations_delete on public.compliance_obligations
for delete using (public.is_property_editor(property_id));

drop trigger if exists compliance_obligations_set_updated_at on public.compliance_obligations;
create trigger compliance_obligations_set_updated_at
before update on public.compliance_obligations
for each row execute function public.set_updated_at();

drop trigger if exists compliance_obligations_set_created_by on public.compliance_obligations;
create trigger compliance_obligations_set_created_by before insert on public.compliance_obligations
for each row execute function public.set_created_by();

drop trigger if exists compliance_obligations_guard_provenance on public.compliance_obligations;
create trigger compliance_obligations_guard_provenance before update on public.compliance_obligations
for each row execute function public.guard_row_provenance();

-- 5. Document linkage -------------------------------------------------------
-- Photos and certificates attach to the new records the same way they attach
-- to repairs and issues: nullable FK columns plus new document_type values.

alter table public.documents
  add column if not exists tenancy_id uuid references public.tenancies(id) on delete set null,
  add column if not exists condition_report_id uuid references public.condition_reports(id) on delete set null,
  add column if not exists condition_report_entry_id uuid references public.condition_report_entries(id) on delete set null,
  add column if not exists compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null;

create index if not exists documents_condition_report_idx
  on public.documents (condition_report_id)
  where condition_report_id is not null;

create index if not exists documents_compliance_obligation_idx
  on public.documents (compliance_obligation_id)
  where compliance_obligation_id is not null;

alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents
  add constraint documents_document_type_check
  check (
    document_type in (
      'manual','warranty','receipt','invoice','quote','inspection_report','service_report','permit','photo',
      'insurance','property_document','utility_document','asset_document','repair_document','issue_document','other',
      'condition_photo','compliance_certificate','tenancy_document'
    )
  );

-- 6. Subscription-capable entitlements --------------------------------------
-- 022's model is one-time purchases. The Portfolio plan is recurring: the
-- webhook stamps provider_subscription_id at checkout, extends expires_at on
-- each paid invoice, and revokes on subscription deletion. has_entitlement()
-- already honours expires_at, so no policy or helper changes are needed —
-- and the write path remains service-role only.

alter table public.entitlements
  add column if not exists provider_subscription_id text;

create unique index if not exists entitlements_subscription_uidx
  on public.entitlements (provider_subscription_id)
  where provider_subscription_id is not null;

-- 7. Text bounds for the new tables (same generator as 013, idempotent) ------

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

notify pgrst, 'reload schema';
