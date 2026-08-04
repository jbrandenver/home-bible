-- 037: mark the reserved-but-unwritten tables as reserved.
--
-- Closes the "Reserved-but-unwritten DB tables" item on docs/LAUNCH_CHECKLIST.md.
-- Seven tables exist with full RLS and policies but have never been written by
-- any code path — verified two ways on 2026-08-04: zero rows in production, and
-- zero references anywhere in apps/web, packages/ or supabase/functions.
--
-- They are commented rather than dropped because each was designed alongside a
-- feature that is planned rather than abandoned, and an empty RLS-protected
-- table costs nothing at rest. Dropping any of them is a roadmap decision, not
-- a housekeeping one. The comments make the schema honest in the meantime: a
-- future reader (or advisor sweep) can tell "not built yet" from "broken".
--
-- Deliberately NOT listed here, though also empty in production — these have
-- shipped writers and are simply unexercised by the only live account:
--   audit_events (written by log_audit_event since 035), compliance_obligations,
--   condition_reports, condition_report_entries, tenancies, plate_scans,
--   recall_matches, entitlements, payment_events, unmatched_purchases,
--   digest_log, trend_flags, automation_device_hubs, automation_device_networks.

comment on table public.systems is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 002 as '
  'a generic parent for major home systems; the shipped model uses utilities + '
  'assets instead. Drop or build; do not assume it is populated.';

comment on table public.entitlement_downloads is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 022 to '
  'log post-purchase access, which is what Stripe asks for as dispute evidence '
  'on digital goods. Worth wiring up before the first chargeback: the log is '
  'impossible to reconstruct after the fact.';

comment on table public.automation_health_checks is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 012 as '
  'manual smart-home history; no UI records health checks yet.';

comment on table public.automation_battery_events is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 012 as '
  'manual smart-home history; no UI records battery changes yet.';

comment on table public.automation_firmware_events is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 012 as '
  'manual smart-home history; no UI records firmware updates yet. Note that '
  'automation_devices.firmware_version IS written — this is the change log for '
  'it, not the current value.';

comment on table public.automation_routine_hubs is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 012 to '
  'link routines to hubs. The shipped routine editor links devices '
  '(automation_routine_devices) and networks only.';

comment on table public.automation_routine_networks is
  'RESERVED — not written by any code path as of 2026-08-04. Defined in 012 to '
  'link routines to networks. See automation_routine_hubs.';
