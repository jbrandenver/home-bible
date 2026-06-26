# Architecture (MVP)

Monorepo layout with TypeScript, pnpm workspaces, Next.js web app, Expo mobile app, shared UI/types packages, and Supabase backend (Postgres, Auth, Storage, Edge Functions).

Protected rules:
- Supabase remains central; RLS enabled on all tables.
- Service role keys are never committed or used in frontends.
- No anonymous read access to private tables.

Phase 1 focuses on secure data model for properties, floors, rooms, and utilities.
