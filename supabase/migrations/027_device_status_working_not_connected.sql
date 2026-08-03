-- 027: add 'working_not_connected' to the automation status vocabulary.
--
-- A device can be doing its job while not talking to its hub or app — a smart
-- lock that still locks, a camera recording locally. Homeowners asked to record
-- exactly that state ("Working but not connected", 2026-08-03). The status
-- CHECK constraints from migration 012 are widened on the three tables that
-- share the device-status list: automation_hubs, automation_devices, and
-- automation_health_checks.
--
-- The constraints were created inline, so they carry PostgreSQL's default
-- names (<table>_status_check). Drop-and-recreate is transactional and safe:
-- every existing value remains valid under the widened list.

alter table public.automation_hubs
  drop constraint if exists automation_hubs_status_check;
alter table public.automation_hubs
  add constraint automation_hubs_status_check
  check (status in ('online','working_not_connected','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown'));

alter table public.automation_devices
  drop constraint if exists automation_devices_status_check;
alter table public.automation_devices
  add constraint automation_devices_status_check
  check (status in ('online','working_not_connected','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown'));

alter table public.automation_health_checks
  drop constraint if exists automation_health_checks_status_check;
alter table public.automation_health_checks
  add constraint automation_health_checks_status_check
  check (status in ('online','working_not_connected','offline','intermittent','needs_attention','low_battery','updating','unconfigured','retired','unknown'));
