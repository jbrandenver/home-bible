# Product Requirements Document (MVP)

Hero feature: structured home map organized by floors, rooms, utilities, appliances, accessories, smart devices, tools, warranties, repairs, and reminders.

Phase 1 scope:
- Auth-ready shell
- Property setup flow
- Property dashboard
- Structured home map (floors, rooms, utilities)

Exclude for phase 1: AI, billing, camera scan, partner integrations, and native mobile parity.

## Current status

- The web MVP includes Supabase-backed property records, rooms, utilities, assets, warranties, reminders, repairs, issues, documents, and approved receipts.
- Demo mode remains available when Supabase is not configured or the user is signed out, but demo data stays in localStorage.
- Sharing is now invitation-backed for signed-in users, with database-enforced role and visibility rules.
- Native mobile is intentionally out of the active workspace until it is scoped as a real product surface.

## Next step

- Polish the signature workflows: handover PDF/print output, emergency overview, proactive reminder digest, and home-completeness score.
- Keep security and RLS regression tests current as sharing roles evolve.
