# Security Summary

## Core rules

- Do not commit secrets (service role keys, private keys, OAuth secrets).
- Frontend apps may only use:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code or frontend env files.

## Data protection model

- Row Level Security (RLS) is required on all private data tables.
- No anonymous reads for private household/property data.
- Viewers are read-only.
- Maintenance guest access is restricted and must not grant broad whole-home visibility.
- Use role-scoped policies for write actions (`owner`, `co_owner`, `editor`).

## Private data rules

The application must not store sensitive home-access secrets in user data fields, including:

- access codes
- lock codes
- garage codes
- safe codes
- alarm codes
- Wi-Fi passwords
- hidden key locations

## Storage rules

- Do not store user files in public buckets.
- Keep user documents private by default.

## Account lifecycle

- Account deletion workflow placeholder is required.
- Future phase: implement full deletion/anonymization flow for user-owned records.

Developers should use `.env.example` and local environment variables for local setup.
