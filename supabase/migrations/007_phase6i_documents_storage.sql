-- Phase 6I documents and private storage
-- Adds private document metadata plus a private Supabase Storage bucket.
-- Objects are intentionally stored under properties/{property_id}/... so Storage RLS
-- can enforce property membership without relying on public URLs or service-role access.

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

create or replace function public.can_read_property_documents(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_member(target_property_id);
$$;

create or replace function public.can_write_property_documents(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_property_editor(target_property_id);
$$;

create or replace function public.document_storage_property_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  property_segment text;
begin
  property_segment := (storage.foldername(object_name))[2];

  if property_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return property_segment::uuid;
  end if;

  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-documents',
  'home-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  utility_id uuid references public.utilities(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  reminder_id uuid references public.reminders(id) on delete set null,
  repair_id uuid references public.repairs(id) on delete set null,
  service_record_id uuid references public.service_records(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  trend_flag_id uuid references public.trend_flags(id) on delete set null,
  document_type text not null default 'other',
  title text not null,
  description text,
  file_name text not null,
  file_path text not null,
  bucket_name text not null default 'home-documents',
  mime_type text,
  file_size_bytes bigint,
  visibility text not null default 'private',
  source text not null default 'manual_upload',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.documents
  add column if not exists property_id uuid references public.properties(id) on delete cascade,
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists utility_id uuid references public.utilities(id) on delete set null,
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists reminder_id uuid references public.reminders(id) on delete set null,
  add column if not exists repair_id uuid references public.repairs(id) on delete set null,
  add column if not exists service_record_id uuid references public.service_records(id) on delete set null,
  add column if not exists issue_id uuid references public.issues(id) on delete set null,
  add column if not exists trend_flag_id uuid references public.trend_flags(id) on delete set null,
  add column if not exists document_type text not null default 'other',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists file_name text,
  add column if not exists file_path text,
  add column if not exists bucket_name text not null default 'home-documents',
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists visibility text not null default 'private',
  add column if not exists source text not null default 'manual_upload',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.documents
  alter column id set default gen_random_uuid(),
  alter column document_type set default 'other',
  alter column bucket_name set default 'home-documents',
  alter column visibility set default 'private',
  alter column source set default 'manual_upload',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.documents
set
  document_type = case
    when document_type in (
      'manual','warranty','receipt','invoice','quote','inspection_report','service_report','permit','photo',
      'insurance','property_document','utility_document','asset_document','repair_document','issue_document','other'
    ) then document_type
    else 'other'
  end,
  visibility = case
    when visibility in ('private','family','maintenance','buyer_report') then visibility
    else 'private'
  end,
  source = case
    when source in ('manual_upload','future_receipt_upload','future_ai_import','system') then source
    else 'manual_upload'
  end,
  bucket_name = coalesce(nullif(bucket_name, ''), 'home-documents'),
  title = coalesce(nullif(title, ''), nullif(file_name, ''), 'Untitled document')
where true;

alter table public.documents
  alter column property_id set not null,
  alter column document_type set not null,
  alter column title set not null,
  alter column file_name set not null,
  alter column file_path set not null,
  alter column bucket_name set not null,
  alter column visibility set not null,
  alter column source set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents drop constraint if exists documents_visibility_check;
alter table public.documents drop constraint if exists documents_source_check;
alter table public.documents drop constraint if exists documents_bucket_name_check;
alter table public.documents drop constraint if exists documents_file_size_check;

alter table public.documents
  add constraint documents_document_type_check
  check (
    document_type in (
      'manual','warranty','receipt','invoice','quote','inspection_report','service_report','permit','photo',
      'insurance','property_document','utility_document','asset_document','repair_document','issue_document','other'
    )
  );

alter table public.documents
  add constraint documents_visibility_check
  check (visibility in ('private','family','maintenance','buyer_report'));

alter table public.documents
  add constraint documents_source_check
  check (source in ('manual_upload','future_receipt_upload','future_ai_import','system'));

alter table public.documents
  add constraint documents_bucket_name_check
  check (bucket_name = 'home-documents');

alter table public.documents
  add constraint documents_file_size_check
  check (file_size_bytes is null or (file_size_bytes >= 0 and file_size_bytes <= 10485760));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_bucket_file_path_key'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_bucket_file_path_key unique (bucket_name, file_path);
  end if;
end $$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists p6i_documents_select on public.documents;
create policy p6i_documents_select on public.documents
for select using (public.can_read_property_documents(property_id) and deleted_at is null);

drop policy if exists p6i_documents_insert on public.documents;
create policy p6i_documents_insert on public.documents
for insert with check (
  public.can_write_property_documents(property_id)
  and bucket_name = 'home-documents'
  and created_by = auth.uid()
);

drop policy if exists p6i_documents_update on public.documents;
create policy p6i_documents_update on public.documents
for update using (public.can_write_property_documents(property_id))
with check (
  public.can_write_property_documents(property_id)
  and bucket_name = 'home-documents'
);

drop policy if exists p6i_documents_delete on public.documents;

create index if not exists documents_property_created_idx
on public.documents (property_id, created_at desc)
where deleted_at is null;

create index if not exists documents_property_type_idx
on public.documents (property_id, document_type, created_at desc)
where deleted_at is null;

create index if not exists documents_room_idx
on public.documents (room_id)
where deleted_at is null and room_id is not null;

create index if not exists documents_utility_idx
on public.documents (utility_id)
where deleted_at is null and utility_id is not null;

create index if not exists documents_asset_idx
on public.documents (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists documents_reminder_idx
on public.documents (reminder_id)
where deleted_at is null and reminder_id is not null;

create index if not exists documents_repair_idx
on public.documents (repair_id)
where deleted_at is null and repair_id is not null;

create index if not exists documents_service_record_idx
on public.documents (service_record_id)
where deleted_at is null and service_record_id is not null;

create index if not exists documents_issue_idx
on public.documents (issue_id)
where deleted_at is null and issue_id is not null;

create index if not exists documents_trend_flag_idx
on public.documents (trend_flag_id)
where deleted_at is null and trend_flag_id is not null;

drop policy if exists p6i_home_documents_select on storage.objects;
create policy p6i_home_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_read_property_documents(public.document_storage_property_id(name))
);

drop policy if exists p6i_home_documents_insert on storage.objects;
create policy p6i_home_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);

drop policy if exists p6i_home_documents_update on storage.objects;
create policy p6i_home_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
)
with check (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);

drop policy if exists p6i_home_documents_delete on storage.objects;
