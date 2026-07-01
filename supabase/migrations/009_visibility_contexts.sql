-- Add multi-select report contexts while preserving the existing single visibility field.
-- This is additive and non-destructive; RLS policies are unchanged.

alter table public.utilities
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.systems
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.assets
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.reminders
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.service_records
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.issues
  add column if not exists visibility_contexts text[] not null default '{}';

alter table public.documents
  add column if not exists visibility_contexts text[] not null default '{}';

update public.utilities
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.systems
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.assets
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.reminders
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.service_records
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.issues
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

update public.documents
set visibility_contexts = case visibility
  when 'family' then array['family']::text[]
  when 'maintenance' then array['maintenance']::text[]
  when 'buyer_report' then array['buyer']::text[]
  else array['personal_archive']::text[]
end
where coalesce(array_length(visibility_contexts, 1), 0) = 0;

alter table public.utilities drop constraint if exists utilities_visibility_contexts_check;
alter table public.utilities
  add constraint utilities_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.systems drop constraint if exists systems_visibility_contexts_check;
alter table public.systems
  add constraint systems_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.assets drop constraint if exists assets_visibility_contexts_check;
alter table public.assets
  add constraint assets_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.reminders drop constraint if exists reminders_visibility_contexts_check;
alter table public.reminders
  add constraint reminders_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.service_records drop constraint if exists service_records_visibility_contexts_check;
alter table public.service_records
  add constraint service_records_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.issues drop constraint if exists issues_visibility_contexts_check;
alter table public.issues
  add constraint issues_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);

alter table public.documents drop constraint if exists documents_visibility_contexts_check;
alter table public.documents
  add constraint documents_visibility_contexts_check
  check (visibility_contexts <@ array['family','buyer','maintenance','insurance','personal_archive']::text[]);
