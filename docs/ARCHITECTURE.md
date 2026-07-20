# Architecture (MVP)

Monorepo layout with TypeScript, pnpm workspaces, a Next.js web app, shared UI/types packages, and Supabase backend (Postgres, Auth, Storage, Edge Functions). The old mobile stub was removed from the active workspace until a real native build is scoped.

## Current runtime model

- The web app supports demo/localStorage mode when Supabase is not configured or the user is signed out.
- Signed-in users read/write primary MVP data through Supabase tables, RLS policies, and private Storage.
- Existing routes continue to run locally without requiring Supabase sign-in, but saved account data uses Supabase.

## Supabase schema overview (Phase 6A)

Core tables:

- `profiles`
- `households`
- `household_members`
- `properties`
- `property_members`
- `floors`
- `rooms`
- `utilities`
- `systems`
- `assets`
- `reminders`
- `service_records`
- `issues`
- `audit_events`
- `documents`
- `receipts`
- `repairs`
- `trend_flags`
- `property_invitations`
- Home Automation: `automation_devices`, `automation_hubs`, `automation_networks`,
  `automation_routines`, `automation_relationships`, and their junction/history
  tables (migration `012`) — see `docs/HOME_AUTOMATION.md`.

RLS helper functions:

- `is_property_member(property_id uuid)`
- `is_property_editor(property_id uuid)`
- `is_property_owner(property_id uuid)`
- `is_property_owner_or_co_owner(property_id uuid)`
- `can_read_property_row(property_id uuid, visibility text, visibility_contexts text[], created_by uuid)`
- `create_property_invitation(...)`
- `accept_property_invitation(invite_token text)`

## Security and policy model

- Supabase remains central.
- RLS is enabled across private tables.
- No service role key in frontend.
- No anonymous private-table reads.
- Writes are restricted to owner/co_owner/editor policies where practical.
- Visibility contexts are database-enforced. Private/personal archive records are creator plus owner/co-owner only.
- Real sharing uses expiring, single-use invitation tokens; only token hashes are stored.
- The service-role key is allowed only in Edge Functions such as account deletion.

## Transition plan

- Security remediation: legacy migration quarantine, policy cleanup, role hierarchy, visibility RLS, and invitation-backed sharing.
- Maintain demo mode as a local-only fallback, with validation on parsed demo data.
