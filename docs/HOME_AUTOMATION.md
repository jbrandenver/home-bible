# Home Automation Module

A property-scoped smart-home inventory that lets a homeowner document every
connected device, understand how devices communicate, see dependencies,
troubleshoot failures, and preserve enough information for someone else to
operate the home during an emergency, sale, move, repair, or handover.

Built entirely on the existing Home Folder architecture (Next.js pages router,
Supabase + RLS, `@home-folder/shared` for constants/types/validation,
`@home-folder/ui` for the design system). No new services, no paid
dependencies, no background jobs.

## Where it lives

- **Home → Smart Home** (`/automation`) — the module is a first-class area of
  the Home section. No sixth primary nav tab was added.
- Dashboard shows a compact automation summary card.
- Documents can be linked to a smart device (Docs section).
- Issues/repairs can be created from a device and read back on its record.

## Routes

| Route | Purpose |
| --- | --- |
| `/automation` | Overview: counts, attention items, local-vs-cloud, shortcuts |
| `/automation/devices` | Device list + filters + quick-add |
| `/automation/add-device` | Guided setup (6 steps, save-and-finish-later) |
| `/automation/devices/[id]` | Device detail + linked records + report issue/repair |
| `/automation/hubs` | Hubs & controllers list + create |
| `/automation/networks` | Networks list + create |
| `/automation/automations` | Automations/scenes list + create |
| `/automation/automations/[id]` | Automation detail + device roles |
| `/automation/map` | Connection map (list-first, 6 views, highlight) |
| `/automation/failure-impact` | "What stops working if this fails?" |
| `/automation/emergency` | Emergency & handover guide (print + export) |

## Data model (migration `012_home_automation.sql`)

15 property-scoped tables, every one following existing conventions
(`property_id` FK, `created_by`, `created_at`/`updated_at`, `deleted_at` soft
delete, `set_updated_at` trigger, RLS via `is_property_member` /
`is_property_editor`):

- `automation_networks`, `automation_hubs`, `automation_devices`,
  `automation_routines`
- `automation_relationships` — typed polymorphic dependency edges
- junctions: `automation_device_protocols`, `automation_device_ecosystems`,
  `automation_device_hubs`, `automation_device_networks`,
  `automation_routine_devices`, `automation_routine_hubs`,
  `automation_routine_networks`
- history: `automation_health_checks`, `automation_battery_events`,
  `automation_firmware_events`

Additive nullable FKs were added to `documents`, `receipts`, `issues`,
`repairs`, and `service_records` (`automation_device_id`, `automation_hub_id`,
`automation_routine_id`) — the same multi-link pattern those tables already use.

### Design decisions

- **Category / protocol / ecosystem are app-validated text**, not global lookup
  tables. This satisfies "expand without a schema redesign," keeps RLS uniform
  (every automation row is property-scoped), and adds no global-table
  maintenance. The valid sets live in `packages/shared/src/automation.ts`.
- **Every table carries `property_id`** (including junctions) so RLS is a single
  uniform `is_property_member(property_id)` check — no nested EXISTS.
- **Failure impact only reports recorded relationships.** It never infers
  dependencies that aren't in the data.

## Failure-impact engine

`apps/web/lib/failureImpact.ts` — pure and unit-tested. Given the recorded graph
and a failure target (hub / network / internet / cloud service / device / power
circuit) it returns affected devices, affected automations, safety/security
callouts, manual alternatives (what still works locally), recovery steps (only
from recorded instructions), and prioritized warnings. Cascades follow recorded
links one level (a failed network takes down hubs on it → their devices).

## Emergency & handover

`apps/web/lib/automationEmergency.ts` assembles a print-friendly guide;
`/automation/emergency` renders it with Print, Export CSV, and Export JSON.

## Health / status

Manual status tracking only in this version (`automation_health_checks` records
history with `source = 'manual' | 'future_integration'`). The schema is designed
so a future integration can insert health rows without changing the core model —
see "Future integrations" below.

## Testing

`apps/web/tests/`:
- `automation-failure-impact.test.ts` — hub/network/internet/cloud/circuit
  impact, cascades, safety/security warnings, overview + completeness
- `automation-connection-map.test.ts` — grouping, no-overlap ids, de-duped
  edges, view flips
- `automation-export.test.ts` — credential-reference redaction (default off /
  opt-in), secret scrubbing, emergency assembly
- `automation-validation.test.ts` — Zod schema guards

Run: `pnpm --filter @home-folder/web test`

## Future integrations (would add recurring cost — deferred)

None of the following are built; each would introduce ongoing cost and must be
explicitly approved before implementation:

- Live vendor/device-cloud polling (SmartThings, Home Assistant, Hue, etc.) —
  recurring API + compute cost; would populate `automation_health_checks` with
  `source = 'future_integration'`.
- Scheduled battery/firmware reminders via cron — recurring job cost.
- CSV import — no recurring cost, but not yet built.
- A global search index — the app currently uses per-list search.
