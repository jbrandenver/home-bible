# Product Requirements Document (MVP)

Hero feature: structured home map organized by floors, rooms, utilities, appliances, accessories, smart devices, tools, warranties, repairs, and reminders.

Phase 1 scope:
- Auth-ready shell
- Property setup flow
- Property dashboard
- Structured home map (floors, rooms, utilities)

Exclude for phase 1: receipts, AI, billing, camera scan, partner integrations.

## Current status

- Phases 1-5 are functional in localStorage mode.
- Phase 6A establishes Supabase backend foundation:
	- schema + migration
	- RLS policies
	- auth-ready browser client helpers
	- security/docs updates
- Existing routes remain localStorage-based until Phase 6B.

## Next step (Phase 6B)

- Incrementally migrate route persistence from localStorage to Supabase tables.
- Keep UX stable while introducing authenticated data reads/writes.
