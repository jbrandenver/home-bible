-- 032: soft deletes were rejected by their own SELECT policies.
--
-- Launch QA 2026-08-03 (Jesse, deleting a utility): "new row violates
-- row-level security policy for table utilities". Root cause: Postgres
-- applies SELECT policies to the updated row of an UPDATE, and the
-- 2026-07-30 security generation (p10_/p11_/automation_) added
-- `deleted_at IS NULL` to every record table's SELECT policy — so the
-- instant a soft-delete sets deleted_at, the new row is invisible to its
-- own writer and the update is rejected. Every delete button in the app
-- has been broken on live since that migration (properties was fixed
-- separately via the delete_property_as_owner RPC in 030; this migration
-- fixes the other 19 record tables). It also explains the original
-- "cannot delete a room" launch-QA report.
--
-- Fix: deleted rows stay invisible to viewers and guest-class roles, but
-- editors (owner / co_owner / editor) may see them — which is what lets
-- their own soft-delete UPDATE succeed, and is a sane basis for any
-- future trash/restore surface. Every client read already filters
-- `deleted_at IS NULL` explicitly, so nothing user-visible changes.
-- Each policy below is the live policy's exact scope expression with
-- `(deleted_at IS NULL)` widened to
-- `((deleted_at IS NULL) OR is_property_editor(property_id))`.

drop policy if exists p10_assets_select on public.assets;
create policy p10_assets_select on public.assets
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists automation_devices_select on public.automation_devices;
create policy automation_devices_select on public.automation_devices
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists automation_hubs_select on public.automation_hubs;
create policy automation_hubs_select on public.automation_hubs
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists automation_networks_select on public.automation_networks;
create policy automation_networks_select on public.automation_networks
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists automation_relationships_select on public.automation_relationships;
create policy automation_relationships_select on public.automation_relationships
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists automation_routines_select on public.automation_routines;
create policy automation_routines_select on public.automation_routines
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p11_compliance_obligations_select on public.compliance_obligations;
create policy p11_compliance_obligations_select on public.compliance_obligations
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p11_condition_report_entries_select on public.condition_report_entries;
create policy p11_condition_report_entries_select on public.condition_report_entries
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p11_condition_reports_select on public.condition_reports;
create policy p11_condition_reports_select on public.condition_reports
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_documents_select on public.documents;
create policy p10_documents_select on public.documents
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_issues_select on public.issues;
create policy p10_issues_select on public.issues
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_receipts_select on public.receipts;
create policy p10_receipts_select on public.receipts
for select using ((((deleted_at IS NULL) OR is_property_editor(property_id)) AND (current_property_role(property_id) = ANY (ARRAY['owner'::text, 'co_owner'::text, 'editor'::text, 'viewer'::text, 'insurance_view'::text]))));

drop policy if exists p10_reminders_select on public.reminders;
create policy p10_reminders_select on public.reminders
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_repairs_select on public.repairs;
create policy p10_repairs_select on public.repairs
for select using ((is_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_rooms_select on public.rooms;
create policy p10_rooms_select on public.rooms
for select using ((can_read_property_room_archive(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_service_records_select on public.service_records;
create policy p10_service_records_select on public.service_records
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p11_tenancies_select on public.tenancies;
create policy p11_tenancies_select on public.tenancies
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_trend_flags_select on public.trend_flags;
create policy p10_trend_flags_select on public.trend_flags
for select using ((is_trusted_property_member(property_id) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));

drop policy if exists p10_utilities_select on public.utilities;
create policy p10_utilities_select on public.utilities
for select using ((can_read_property_row(property_id, visibility, visibility_contexts, created_by) AND ((deleted_at IS NULL) OR is_property_editor(property_id))));
