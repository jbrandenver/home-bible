-- 033: launch security hardening.
--
-- Findings from the 2026-08-04 full-surface audit. Eight independent fixes,
-- grouped here because they all close the same class of gap: a boundary the
-- product promises in JavaScript that Postgres was not enforcing.
--
-- 1. Guest-class column exposure on five more tables (the 031 pattern, applied
--    everywhere it was still missing).
-- 2. recall_matches UPDATE was unbounded — editors could rewrite a safety
--    notice into a phishing lure, or soft-delete it without a trail.
-- 3. storage.objects SELECT authorised on a client-supplied column instead of
--    the object path (a regression 015 introduced over 007).
-- 4. Archive / restore of a home was owner-only in client JS, editor-capable
--    in the database.
-- 5. households.owner_user_id had no immutability guard (properties has one).
-- 6. properties.household_id was never validated against membership.
-- 7. audit_events was guest-readable and member-forgeable.
-- 8. Five SELECT policies still reject their own soft-deletes (032 follow-up).

-- ---------------------------------------------------------------------------
-- 1. Guest-class roles must not read private columns.
--
-- Same mechanic and same Postgres gotcha as 031: `revoke select (col)` is a
-- no-op while a table-level SELECT grant exists, so the table grant is revoked
-- and every non-sensitive column is re-granted individually. Columns used in
-- WHERE/ORDER BY must stay granted even when never displayed.
--
-- The withheld columns are exactly the ones lib/sharing.ts::stripPrivateDetails
-- blanks for guests — that function is now a UI convenience, not the boundary.
-- ---------------------------------------------------------------------------

revoke select on public.assets from authenticated, anon;
grant select (
  id, property_id, room_id, asset_type, name, brand, model,
  purchase_date, warranty_length_months, warranty_expires_at,
  manual_url, support_url, visibility, created_at, updated_at, deleted_at,
  visibility_contexts, created_by
) on public.assets to authenticated;

revoke select on public.service_records from authenticated, anon;
grant select (
  id, property_id, room_id, utility_id, asset_id, service_type, title,
  service_date, vendor_name, follow_up_needed, follow_up_date, visibility,
  created_at, updated_at, deleted_at, service_title, provider_name,
  next_service_date, visibility_contexts, automation_device_id,
  automation_hub_id, created_by
) on public.service_records to authenticated;

revoke select on public.issues from authenticated, anon;
grant select (
  id, property_id, room_id, utility_id, asset_id, issue_type, title, status,
  severity, date_found, resolution_date, shareable_notes, visibility,
  created_at, updated_at, deleted_at, repair_id, first_seen_date,
  last_seen_date, resolved_date, visibility_contexts, automation_device_id,
  automation_hub_id, automation_routine_id, created_by
) on public.issues to authenticated;

revoke select on public.reminders from authenticated, anon;
grant select (
  id, property_id, room_id, utility_id, asset_id, title, reminder_type,
  due_date, linked_type, linked_id, status, visibility, created_at,
  updated_at, deleted_at, frequency, priority, source, visibility_contexts,
  created_by
) on public.reminders to authenticated;

revoke select on public.utilities from authenticated, anon;
grant select (
  id, property_id, room_id, utility_type, name, location_notes, visibility,
  created_at, updated_at, deleted_at, visibility_contexts, created_by,
  device_id
) on public.utilities to authenticated;

-- Full-household roles get the withheld columns back through these readers.
-- Each re-checks the caller's per-property role internally, which is the thing
-- a column grant cannot express.

create or replace function public.get_assets_private_fields(p_asset_ids uuid[])
returns table (
  asset_id uuid,
  serial_number text,
  purchase_price numeric,
  retailer text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.serial_number, a.purchase_price, a.retailer, a.notes
  from public.assets a
  where a.id = any(p_asset_ids)
    and a.deleted_at is null
    and public.current_property_role(a.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_assets_private_fields(uuid[]) from public, anon;
grant execute on function public.get_assets_private_fields(uuid[]) to authenticated;

create or replace function public.get_service_records_private_fields(p_service_record_ids uuid[])
returns table (
  service_record_id uuid,
  description text,
  cost numeric,
  vendor_phone text,
  vendor_email text,
  provider_phone text,
  provider_email text,
  summary text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.description, s.cost, s.vendor_phone, s.vendor_email,
         s.provider_phone, s.provider_email, s.summary, s.notes
  from public.service_records s
  where s.id = any(p_service_record_ids)
    and s.deleted_at is null
    and public.current_property_role(s.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_service_records_private_fields(uuid[]) from public, anon;
grant execute on function public.get_service_records_private_fields(uuid[]) to authenticated;

create or replace function public.get_issues_private_fields(p_issue_ids uuid[])
returns table (
  issue_id uuid,
  description text,
  private_notes text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.description, i.private_notes, i.notes
  from public.issues i
  where i.id = any(p_issue_ids)
    and i.deleted_at is null
    and public.current_property_role(i.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_issues_private_fields(uuid[]) from public, anon;
grant execute on function public.get_issues_private_fields(uuid[]) to authenticated;

create or replace function public.get_reminders_private_fields(p_reminder_ids uuid[])
returns table (
  reminder_id uuid,
  description text,
  repeat_rule text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.description, r.repeat_rule
  from public.reminders r
  where r.id = any(p_reminder_ids)
    and r.deleted_at is null
    and public.current_property_role(r.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_reminders_private_fields(uuid[]) from public, anon;
grant execute on function public.get_reminders_private_fields(uuid[]) to authenticated;

create or replace function public.get_utilities_private_fields(p_utility_ids uuid[])
returns table (
  utility_id uuid,
  emergency_notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.emergency_notes
  from public.utilities u
  where u.id = any(p_utility_ids)
    and u.deleted_at is null
    and public.current_property_role(u.property_id) in ('owner','co_owner','editor','viewer')
$$;

revoke all on function public.get_utilities_private_fields(uuid[]) from public, anon;
grant execute on function public.get_utilities_private_fields(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. recall_matches: dismissal only, not rewriting.
--
-- 024 blocked INSERT so nobody could fabricate an official-looking recall, and
-- blocked DELETE so a dismissal always leaves a trail. An unrestricted UPDATE
-- granted both back: an editor could rewrite title/hazard/remedy/recall_url
-- into a phishing lure the owner sees as a CPSC notice, or set deleted_at and
-- make the row vanish (the SELECT policy requires deleted_at is null).
-- Column-level UPDATE confines the write to the one column that is a decision.
-- ---------------------------------------------------------------------------

revoke update on public.recall_matches from authenticated, anon;
grant update (status) on public.recall_matches to authenticated;

-- ---------------------------------------------------------------------------
-- 3. storage.objects SELECT must authorise on the path, not on a row the
--    client wrote.
--
-- 007 checked the object's own path. 015 replaced that with a join against
-- public.documents on file_path — a column the client supplies at insert. Any
-- object with no documents row (thumbnails, orphaned uploads whose metadata
-- insert failed) could be reached by registering a documents row pointing at
-- someone else's path. Restoring the path check as an AND keeps the visibility
-- rules 015 added while putting authorisation back on the object itself.
-- ---------------------------------------------------------------------------

drop policy if exists p10_home_documents_select on storage.objects;

create policy p10_home_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_read_property_documents(public.document_storage_property_id(name))
  and (
    -- A registered document additionally honours its own visibility rules.
    not exists (
      select 1 from public.documents d
      where d.bucket_name = bucket_id and d.file_path = name and d.deleted_at is null
    )
    or exists (
      select 1 from public.documents d
      where d.bucket_name = bucket_id
        and d.file_path = name
        and d.deleted_at is null
        and public.can_read_property_row(d.property_id, d.visibility, d.visibility_contexts, d.created_by)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 4. Archiving a home is an owner action.
--
-- lib/properties.ts filtered on owner_user_id client-side and said so in a
-- comment; the RLS policy behind it admits any editor. An editor could archive
-- the owner's home, and purge_expired_archived_properties — which the owner's
-- own session runs on portfolio load — would later soft-delete it. Same shape
-- as delete_property_as_owner (030), which is why deletion was already safe.
-- ---------------------------------------------------------------------------

create or replace function public.archive_property_as_owner(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if not public.is_property_owner_or_co_owner(p_property_id) then
    raise exception 'only the owner can archive this home';
  end if;

  -- A building archives its units with it, same as delete.
  update public.properties
     set archived_at = now()
   where (id = p_property_id or parent_property_id = p_property_id)
     and deleted_at is null;
end;
$$;

revoke all on function public.archive_property_as_owner(uuid) from public, anon;
grant execute on function public.archive_property_as_owner(uuid) to authenticated;

create or replace function public.restore_property_as_owner(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  if not public.is_property_owner_or_co_owner(p_property_id) then
    raise exception 'only the owner can restore this home';
  end if;

  update public.properties
     set archived_at = null
   where (id = p_property_id or parent_property_id = p_property_id)
     and deleted_at is null;
end;
$$;

revoke all on function public.restore_property_as_owner(uuid) from public, anon;
grant execute on function public.restore_property_as_owner(uuid) to authenticated;

-- Editors keep every ordinary edit; only the two archive columns are withheld,
-- so the RPCs above are the sole path to archiving.
revoke update on public.properties from authenticated, anon;
grant update (
  household_id, nickname, property_type, address_line_1, address_line_2,
  city, state, postal_code, country, address_is_enabled, square_feet,
  year_built, floor_count, has_garage, has_basement, has_attic,
  has_crawl_space, has_yard, has_shed, updated_at, deleted_at,
  parent_property_id, unit_label
) on public.properties to authenticated;

-- ---------------------------------------------------------------------------
-- 5. households.owner_user_id immutability.
--
-- properties has guard_property_owner_user_id; households never got the
-- equivalent, and its UPDATE policy admits any household editor. A household
-- editor could set owner_user_id to themselves, become owner, and then delete
-- the household — which cascades to every property, document, asset and repair
-- inside it. No product path grants household-editor today, so this is a
-- latent gap being closed before one does.
-- ---------------------------------------------------------------------------

create or replace function public.guard_household_owner_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.owner_user_id is distinct from new.owner_user_id
    and auth.role() <> 'service_role'
    and coalesce(current_setting('app.claiming_property_transfer', true), '') <> 'on' then
    raise exception 'owner_user_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists households_guard_owner_user_id on public.households;
create trigger households_guard_owner_user_id
before update on public.households
for each row execute function public.guard_household_owner_user_id();

-- ---------------------------------------------------------------------------
-- 6. A property must belong to a household the caller is in.
--
-- p10_properties_insert_owner checked only owner_user_id; the nesting guard
-- validates household only for units. A user could file a property into an
-- arbitrary household id, corrupting that household's roll-ups.
-- ---------------------------------------------------------------------------

create or replace function public.guard_property_household_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.household_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.household_id is not distinct from new.household_id then
    return new;
  end if;

  -- Ownership transfer reassigns the household on the claimant's behalf.
  if coalesce(current_setting('app.claiming_property_transfer', true), '') = 'on'
     or auth.role() = 'service_role' then
    return new;
  end if;

  if not public.is_household_member(new.household_id) then
    raise exception 'a home must belong to a household you are a member of';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_guard_household_membership on public.properties;
create trigger properties_guard_household_membership
before insert or update on public.properties
for each row execute function public.guard_property_household_membership();

-- ---------------------------------------------------------------------------
-- 7. audit_events: trusted members read, nobody forges.
--
-- SELECT used is_property_member, which is true for maintenance_guest,
-- buyer_preview and insurance_view — a guest could read the property's whole
-- audit stream including free-form event_payload. INSERT let any member forge
-- entries, which defeats the point of an audit trail. The table is not yet
-- written by application code, so this is corrected before first use.
-- ---------------------------------------------------------------------------

drop policy if exists p6a_audit_events_select on public.audit_events;
create policy p6a_audit_events_select on public.audit_events
for select
using (
  (actor_user_id = (select auth.uid()))
  or ((property_id is not null) and public.is_trusted_property_member(property_id))
);

drop policy if exists p6a_audit_events_insert on public.audit_events;
revoke insert, update, delete on public.audit_events from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 8. Soft-delete follow-up for the five tables 032 missed.
--
-- 032 widened 19 SELECT policies to `(deleted_at is null) or is_property_editor(...)`
-- so that a soft-delete does not immediately hide the row from the statement
-- performing it. These five kept a bare `deleted_at is null` and still fail
-- with "new row violates row-level security policy" on soft-delete.
-- ---------------------------------------------------------------------------

drop policy if exists p10_floors_select on public.floors;
create policy p10_floors_select on public.floors
for select
using (
  public.can_read_property_room_archive(property_id)
  and ((deleted_at is null) or public.is_property_editor(property_id))
);

drop policy if exists p10_systems_select on public.systems;
create policy p10_systems_select on public.systems
for select
using (
  public.can_read_property_row(property_id, visibility, visibility_contexts, created_by)
  and ((deleted_at is null) or public.is_property_editor(property_id))
);

drop policy if exists p11_recall_matches_select on public.recall_matches;
create policy p11_recall_matches_select on public.recall_matches
for select
using (
  public.is_trusted_property_member(property_id)
  and ((deleted_at is null) or public.is_property_editor(property_id))
);

drop policy if exists p12_partners_select_own on public.partners;
create policy p12_partners_select_own on public.partners
for select
using (
  ((select auth.uid()) = user_id)
  and ((deleted_at is null) or ((select auth.uid()) = user_id))
);

drop policy if exists p12_property_transfers_select on public.property_transfers;
create policy p12_property_transfers_select on public.property_transfers
for select
using (
  (((select auth.uid()) = issuer_user_id) or ((select auth.uid()) = claimed_by))
);

-- ---------------------------------------------------------------------------
-- 11. A deleted home stops being readable.
--
-- current_property_role's owner branch checks properties.deleted_at, but the
-- membership branch never did. 032 then widened every record table's SELECT to
-- `(deleted_at is null) or is_property_editor(...)` so soft-deletes could work
-- at all. Together those meant that after an owner deleted a home, anyone
-- holding a co-owner or editor seat still resolved to a role and could keep
-- reading every asset, document, repair and receipt in it through the API,
-- indefinitely. The owner believes the record is gone.
-- ---------------------------------------------------------------------------

create or replace function public.current_property_role(target_property_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when exists (
      select 1 from public.properties p
      where p.id = target_property_id
        and p.deleted_at is null
        and p.owner_user_id = auth.uid()
    ) then 'owner'
    else (
      select pm.role
      from public.property_members pm
      join public.properties p on p.id = pm.property_id
      where pm.property_id = target_property_id
        and pm.deleted_at is null
        and pm.user_id = auth.uid()
        and p.deleted_at is null
      order by case pm.role
        when 'owner' then 1
        when 'co_owner' then 2
        when 'editor' then 3
        when 'viewer' then 4
        when 'maintenance_guest' then 5
        when 'buyer_preview' then 6
        when 'insurance_view' then 7
        else 99
      end
      limit 1
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- 9. profiles.email must not be self-assertable.
--
-- The Stripe webhook falls back to matching a checkout email against
-- profiles.email when a purchase carries no client_reference_id — which is the
-- normal path for someone who buys before signing in. profiles.email was a
-- plain column the browser could write, so an attacker could set it to a
-- victim's address and be credited with the victim's purchase.
--
-- The column becomes read-only to clients and is maintained from auth.users,
-- which is the verified source. The webhook is updated in the same change to
-- resolve buyers against auth.users directly.
-- ---------------------------------------------------------------------------

revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, updated_at, deleted_at) on public.profiles to authenticated;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = lower(new.email), updated_at = now();
  return new;
end;
$$;

drop trigger if exists auth_users_sync_profile_email on auth.users;
create trigger auth_users_sync_profile_email
after insert or update of email on auth.users
for each row execute function public.sync_profile_email();

-- Reconcile any drift that predates the guard.
update public.profiles p
   set email = lower(u.email), updated_at = now()
  from auth.users u
 where u.id = p.id
   and p.email is distinct from lower(u.email);

-- The webhook resolves an unattributed purchase against the verified address
-- in auth.users rather than the public mirror. Service-role only: this maps an
-- email to a user id, which is exactly the enumeration primitive no client
-- should hold.
create or replace function public.resolve_user_id_by_verified_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.resolve_user_id_by_verified_email(text) from public, anon, authenticated;
grant execute on function public.resolve_user_id_by_verified_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. A completed condition report is evidence, not a draft.
--
-- The UI hides every edit control once status = 'completed', and the product
-- positions these reports as deposit evidence under CA AB 2801. Postgres let
-- any editor reopen a completed report, rewrite the entries, backdate
-- completed_at and re-complete — which makes the timestamp worse than absent.
-- Reopening stays possible, but it cannot be done while pretending the report
-- was never touched: completed_at may only move forward from a reopen.
-- ---------------------------------------------------------------------------

create or replace function public.guard_completed_condition_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.status = 'completed' then
    -- The only permitted transition out of completed is an explicit reopen to
    -- draft, which must clear the completion stamp rather than rewrite it.
    if new.status = 'completed' then
      raise exception 'a completed condition report cannot be edited; reopen it first';
    end if;
    if new.status <> 'draft' then
      raise exception 'a completed condition report can only be reopened as a draft';
    end if;
    if new.completed_at is not null then
      raise exception 'reopening a condition report must clear completed_at';
    end if;
  end if;

  -- completed_at is set by completion, never backdated by hand.
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists condition_reports_guard_completed on public.condition_reports;
create trigger condition_reports_guard_completed
before update on public.condition_reports
for each row execute function public.guard_completed_condition_report();

create or replace function public.guard_completed_condition_report_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_status text;
  target_report uuid;
begin
  if auth.role() = 'service_role' then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  target_report := case tg_op when 'DELETE' then old.report_id else new.report_id end;

  select status into parent_status
  from public.condition_reports
  where id = target_report;

  if parent_status = 'completed' then
    raise exception 'entries of a completed condition report cannot be changed; reopen the report first';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists condition_report_entries_guard_completed on public.condition_report_entries;
create trigger condition_report_entries_guard_completed
before insert or update or delete on public.condition_report_entries
for each row execute function public.guard_completed_condition_report_entry();
