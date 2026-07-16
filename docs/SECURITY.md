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
- Private record visibility is enforced in the database. A row marked private/personal archive is readable only by its creator plus the property owner/co-owners.
- Family, maintenance, buyer, and insurance contexts are enforced by RLS for the corresponding member roles.
- Property membership changes and invitations are owner/co-owner managed. Editors cannot self-promote, delete properties, or grant owner/co-owner roles.

## Hosted database remediation

Before any non-local use, run this in the hosted Supabase SQL editor and confirm no quarantined `001_init.sql` policies remain:

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Apply `010_security_privacy_sharing.sql` to drop legacy policies, enforce role hierarchy, add invitation-backed sharing, and enforce visibility-aware RLS.

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
- Document signed URLs should request attachment/download behavior with sanitized filenames.
- Asset manual/support URLs must be HTTP(S)-only. `javascript:`, `data:`, and other schemes are rejected on write and guarded on render.

## Account lifecycle

- Account deletion is implemented through the `delete-account` Supabase Edge Function. The service-role key must exist only in the function environment.
- The deletion flow removes memberships, anonymizes the profile, transfers owned homes to an available co-owner, soft-deletes ownerless homes, and deletes the Auth user.

## Demo mode

- Demo data is stored in browser localStorage and is not encrypted.
- Demo mode must not be used for sensitive home-access details, passwords, codes, or hidden-key locations.

Developers should use `.env.example` and local environment variables for local setup.

## Home Automation module

- All 15 `automation_*` tables are property-scoped with RLS via
  `is_property_member` (read) / `is_property_editor` (write). Verified live:
  the anon role receives `[]`, and the security advisor report is unchanged
  from baseline (no new lints, no RLS gaps).
- **Secrets are never stored.** Only *reference* fields are kept
  (`credential_reference`, `account_reference`, `service_account_reference`) —
  e.g. a password-manager item name. Wi-Fi passwords, alarm/door codes, API
  keys, recovery codes, and tokens must never be entered.
- Exports exclude credential references by default; the owner can opt in per
  export. Free-text (reset/handover/troubleshooting notes) is scrubbed with the
  shared `safeText()` before it appears in exports or the emergency guide.
- The emergency & handover report excludes sensitive fields by design.
