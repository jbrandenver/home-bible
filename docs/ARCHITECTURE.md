# Architecture (MVP)

Monorepo layout with TypeScript, pnpm workspaces, Next.js web app, Expo mobile app, shared UI/types packages, and Supabase backend (Postgres, Auth, Storage, Edge Functions).

## Current runtime model

- The web app currently uses localStorage for working UI flows.
- Supabase foundation (schema, RLS, client/auth helpers) is prepared in Phase 6A.
- Existing routes continue to run locally without requiring Supabase sign-in.

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

RLS helper functions:

- `is_property_member(property_id uuid)`
- `is_property_editor(property_id uuid)`
- `is_property_owner(property_id uuid)`

## Security and policy model

- Supabase remains central.
- RLS is enabled across private tables.
- No service role key in frontend.
- No anonymous private-table reads.
- Writes are restricted to owner/co_owner/editor policies where practical.

## Transition plan

- Phase 6A: backend-ready schema and auth client setup (done).
- Phase 6B: migrate screens from localStorage persistence to Supabase persistence incrementally.
