-- Phase 6J receipts
-- Adds structured receipt metadata that is created only after explicit user approval.
-- Receipt files continue to live in the existing private home-documents bucket via public.documents.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  repair_id uuid references public.repairs(id) on delete set null,
  service_record_id uuid references public.service_records(id) on delete set null,
  vendor_name text,
  purchase_date date,
  total_amount numeric,
  tax_amount numeric,
  currency text not null default 'USD',
  payment_method text,
  category text not null default 'other',
  description text,
  notes text,
  approval_status text not null default 'approved',
  source text not null default 'manual_review',
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.receipts
  add column if not exists property_id uuid references public.properties(id) on delete cascade,
  add column if not exists document_id uuid references public.documents(id) on delete set null,
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists utility_id uuid references public.utilities(id) on delete set null,
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists repair_id uuid references public.repairs(id) on delete set null,
  add column if not exists service_record_id uuid references public.service_records(id) on delete set null,
  add column if not exists vendor_name text,
  add column if not exists purchase_date date,
  add column if not exists total_amount numeric,
  add column if not exists tax_amount numeric,
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_method text,
  add column if not exists category text not null default 'other',
  add column if not exists description text,
  add column if not exists notes text,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists source text not null default 'manual_review',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.receipts
  alter column id set default gen_random_uuid(),
  alter column currency set default 'USD',
  alter column category set default 'other',
  alter column approval_status set default 'approved',
  alter column source set default 'manual_review',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.receipts
set
  currency = upper(coalesce(nullif(currency, ''), 'USD')),
  category = case
    when category in (
      'appliance','tool','utility','repair','maintenance','warranty','home_improvement','furniture',
      'electronics','supplies','inspection','permit','insurance','other'
    ) then category
    else 'other'
  end,
  approval_status = case
    when approval_status in ('draft','needs_review','approved','rejected') then approval_status
    else 'approved'
  end,
  source = case
    when source in ('manual_entry','manual_review','future_ai_parse','future_ocr_parse') then source
    else 'manual_review'
  end
where true;

alter table public.receipts
  alter column property_id set not null,
  alter column currency set not null,
  alter column category set not null,
  alter column approval_status set not null,
  alter column source set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.receipts drop constraint if exists receipts_category_check;
alter table public.receipts drop constraint if exists receipts_approval_status_check;
alter table public.receipts drop constraint if exists receipts_source_check;
alter table public.receipts drop constraint if exists receipts_currency_check;
alter table public.receipts drop constraint if exists receipts_amounts_check;

alter table public.receipts
  add constraint receipts_category_check
  check (
    category in (
      'appliance','tool','utility','repair','maintenance','warranty','home_improvement','furniture',
      'electronics','supplies','inspection','permit','insurance','other'
    )
  );

alter table public.receipts
  add constraint receipts_approval_status_check
  check (approval_status in ('draft','needs_review','approved','rejected'));

alter table public.receipts
  add constraint receipts_source_check
  check (source in ('manual_entry','manual_review','future_ai_parse','future_ocr_parse'));

alter table public.receipts
  add constraint receipts_currency_check
  check (currency ~ '^[A-Z]{3}$');

alter table public.receipts
  add constraint receipts_amounts_check
  check (
    (total_amount is null or total_amount >= 0)
    and (tax_amount is null or tax_amount >= 0)
  );

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

alter table public.receipts enable row level security;

drop policy if exists p6j_receipts_select on public.receipts;
create policy p6j_receipts_select on public.receipts
for select using (
  (public.is_property_member(property_id) and deleted_at is null)
  or public.is_property_editor(property_id)
);

drop policy if exists p6j_receipts_insert on public.receipts;
create policy p6j_receipts_insert on public.receipts
for insert with check (
  public.is_property_editor(property_id)
  and created_by = auth.uid()
  and approved_by = auth.uid()
  and approval_status = 'approved'
  and source in ('manual_entry','manual_review')
);

drop policy if exists p6j_receipts_update on public.receipts;
create policy p6j_receipts_update on public.receipts
for update using (public.is_property_editor(property_id))
with check (public.is_property_editor(property_id));

drop policy if exists p6j_receipts_delete on public.receipts;

create index if not exists receipts_property_date_idx
on public.receipts (property_id, purchase_date desc, created_at desc)
where deleted_at is null;

create unique index if not exists receipts_document_id_unique_idx
on public.receipts (document_id)
where document_id is not null and deleted_at is null;

create index if not exists receipts_room_idx
on public.receipts (room_id)
where deleted_at is null and room_id is not null;

create index if not exists receipts_utility_idx
on public.receipts (utility_id)
where deleted_at is null and utility_id is not null;

create index if not exists receipts_asset_idx
on public.receipts (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists receipts_repair_idx
on public.receipts (repair_id)
where deleted_at is null and repair_id is not null;

create index if not exists receipts_service_record_idx
on public.receipts (service_record_id)
where deleted_at is null and service_record_id is not null;

notify pgrst, 'reload schema';
