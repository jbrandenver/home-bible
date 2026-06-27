-- Phase 6E reminders migration
-- Upgrade the existing reminders table for Supabase-backed reminder flows.

alter table public.reminders
  add column if not exists description text,
  add column if not exists frequency text not null default 'none',
  add column if not exists priority text not null default 'normal',
  add column if not exists source text not null default 'manual';

alter table public.reminders
  alter column due_date drop not null;

alter table public.reminders drop constraint if exists reminders_reminder_type_check;
alter table public.reminders drop constraint if exists reminders_frequency_check;
alter table public.reminders drop constraint if exists reminders_status_check;
alter table public.reminders drop constraint if exists reminders_priority_check;
alter table public.reminders drop constraint if exists reminders_source_check;

update public.reminders
set
  room_id = case
    when room_id is null and linked_type = 'room' then linked_id
    else room_id
  end,
  utility_id = case
    when utility_id is null and linked_type = 'utility' then linked_id
    else utility_id
  end,
  asset_id = case
    when asset_id is null and linked_type = 'asset' then linked_id
    else asset_id
  end,
  reminder_type = case reminder_type
    when 'warranty_expiration' then 'warranty'
    when 'hvac_filter' then 'filter_change'
    when 'custom' then 'general'
    when 'general' then 'general'
    when 'maintenance' then 'maintenance'
    when 'warranty' then 'warranty'
    when 'filter_change' then 'filter_change'
    when 'inspection' then 'inspection'
    when 'seasonal' then 'seasonal'
    when 'utility' then 'utility'
    when 'asset' then 'asset'
    when 'other' then 'other'
    else 'general'
  end,
  status = case status
    when 'done' then 'completed'
    when 'snoozed' then 'dismissed'
    when 'open' then 'open'
    when 'completed' then 'completed'
    when 'dismissed' then 'dismissed'
    else 'open'
  end,
  frequency = case
    when lower(coalesce(frequency, repeat_rule, 'none')) in (
      'none','weekly','monthly','quarterly','semiannual','annual','custom'
    )
      then lower(coalesce(frequency, repeat_rule, 'none'))
    else 'custom'
  end,
  source = case
    when reminder_type = 'warranty_expiration' then 'warranty'
    when coalesce(source, 'manual') in ('manual','warranty','asset','utility','system_suggestion')
      then coalesce(source, 'manual')
    else 'manual'
  end,
  priority = case
    when coalesce(priority, 'normal') in ('low','normal','high','urgent') then coalesce(priority, 'normal')
    else 'normal'
  end
where true;

alter table public.reminders
  add constraint reminders_reminder_type_check
  check (
    reminder_type in (
      'general','maintenance','warranty','filter_change','inspection','seasonal','utility','asset','other'
    )
  );

alter table public.reminders
  add constraint reminders_frequency_check
  check (frequency in ('none','weekly','monthly','quarterly','semiannual','annual','custom'));

alter table public.reminders
  add constraint reminders_status_check
  check (status in ('open','completed','dismissed'));

alter table public.reminders
  add constraint reminders_priority_check
  check (priority in ('low','normal','high','urgent'));

alter table public.reminders
  add constraint reminders_source_check
  check (source in ('manual','warranty','asset','utility','system_suggestion'));

alter table public.reminders enable row level security;

drop policy if exists p6e_reminders_select on public.reminders;
create policy p6e_reminders_select on public.reminders
for select using (public.is_property_member(property_id) and deleted_at is null);

drop policy if exists p6e_reminders_insert on public.reminders;
create policy p6e_reminders_insert on public.reminders
for insert with check (public.is_property_editor(property_id));

drop policy if exists p6e_reminders_update on public.reminders;
create policy p6e_reminders_update on public.reminders
for update using (public.is_property_editor(property_id)) with check (public.is_property_editor(property_id));

drop policy if exists p6e_reminders_delete on public.reminders;
create policy p6e_reminders_delete on public.reminders
for delete using (public.is_property_editor(property_id));

create index if not exists reminders_property_open_due_idx
on public.reminders (property_id, status, due_date)
where deleted_at is null;

create index if not exists reminders_room_idx
on public.reminders (room_id)
where deleted_at is null and room_id is not null;

create index if not exists reminders_asset_idx
on public.reminders (asset_id)
where deleted_at is null and asset_id is not null;

create index if not exists reminders_utility_idx
on public.reminders (utility_id)
where deleted_at is null and utility_id is not null;
