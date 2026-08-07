-- 044: repairs.notes and repairs.description leave the guest-readable grant.
--
-- Part two of two, and the one with the sharp edge. APPLY ONLY AFTER the web
-- client that stops naming these columns in REPAIR_SELECT is deployed.
--
-- Why the order matters: a withheld column does not come back as null, it
-- aborts the whole query. Verified against this database in a rolled-back
-- transaction — `select description from repairs` as `authenticated` after the
-- revoke fails with "permission denied for table repairs", while granted
-- columns keep working. The currently-deployed lib/repairs.ts still asks for
-- description and notes, so applying this before the deploy would 403 every
-- repairs list and detail read for OWNERS, not just guests.
--
-- What this closes: 031 moved contractor contacts and costs behind
-- get_repairs_private_fields but left description and notes on the grant. Both
-- are private text by the product's own definition — lib/sharing.ts
-- ::stripPrivateDetails blanks both for every guest-class role, and the role
-- matrix advertises "Private notes" under `cannotSee` for maintenance_guest
-- and buyer_preview. That promise was JavaScript-only. The repairs RLS select
-- policy is `is_property_member`, true for maintenance_guest, buyer_preview
-- and insurance_view alike, so any guest with a session could read both
-- columns straight from PostgREST.
--
-- repairs was the last table in this family still relying on client-side
-- blanking: assets.notes, service_records.notes/description,
-- issues.notes/private_notes/description and reminders.description were all
-- moved to RPC-only by 033. The pattern is now uniform across all six.
--
-- Checked before withholding: no server-side query filters or orders by
-- either column. lib/repairs.ts filters on property_id/asset_id/utility_id and
-- orders by created_at; the keyword search in pages/repairs.tsx runs
-- client-side over rows the RPC has already re-merged, so full-household
-- search is unchanged and guests simply have nothing to match.
--
-- Same Postgres gotcha 031 and 033 documented: `revoke select (col)` is a
-- no-op while a table-level SELECT grant exists, so the table grant is revoked
-- and every non-sensitive column re-granted individually.

revoke select on public.repairs from authenticated, anon;

grant select (
  id, property_id, room_id, asset_id, utility_id, title,
  repair_type, status, priority, reported_date, completed_date,
  created_at, updated_at, deleted_at, automation_device_id,
  automation_hub_id, scheduled_date, scheduled_window, created_by
) on public.repairs to authenticated;
