# Release Candidate Checklist

## Purpose

This checklist packages Home Bible as a local/private MVP release candidate. It is for controlled testing only. It does not approve production deployment, public sharing, paid services, background jobs, or external integrations.

## Current MVP Scope

- Supabase auth with signed-in and demo mode behavior
- Property onboarding with optional address
- Floors, rooms, and home map
- Utilities, assets, warranties, and reminders
- Repairs and service records
- Issues and trend flags
- Private documents
- Receipt approval workflow
- Browser-only Home Handover reports
- Sharing and access review preview
- Private MVP test checklist and manual seed walkthrough

## Explicitly Out Of Scope

- Production deployment
- Public sharing
- Real guest invitations
- Email, SMS, or push notifications
- AI/OCR parsing
- Billing
- Partner recommendations
- Gmail or Outlook inbox connection
- Exact CAD-style floor plan
- Public file links
- Native mobile app release
- Background jobs, cron, realtime, or Edge Functions

## Local Build Checks

Run:

```bash
corepack pnpm --filter @home-bible/web build
corepack pnpm security:audit
```

Expected result:

- Build passes.
- Security/cost audit reports zero failures.
- Any warnings are known manual-review items.

## Manual Route Checks

Start the local app:

```bash
corepack pnpm dev:web
```

Check:

- `/`
- `/sign-up`
- `/sign-in`
- `/dashboard`
- `/home-map`
- `/settings`
- `/utilities`
- `/assets`
- `/warranties`
- `/reminders`
- `/repairs`
- `/issues`
- `/documents`
- `/receipts`
- `/handover`
- `/sharing`
- `/mvp-test`
- `/rooms/[id]`
- `/assets/[id]`
- `/utilities/[id]`
- `/repairs/[id]`
- `/issues/[id]`

Each route should load without a blank screen or unhandled error.

## Supabase Checks

- Confirm the intended Supabase project is selected.
- Confirm no preview branch is active.
- Confirm auth is enabled for the intended test users.
- Confirm tables exist for the current MVP schema.
- Confirm RLS remains enabled on user-data tables.
- Confirm migrations through `008_phase6j_receipts.sql` are applied.
- Confirm the `home-documents` bucket exists and is private.
- Confirm no public buckets exist for user files.

## Security Checks

- No service role key is present in frontend code.
- No secrets are committed.
- Private documents use signed access only.
- No public file links appear for private files.
- The app does not ask testers to enter sensitive access details.
- Viewer-style previews remain read-only.
- Maintenance-style previews do not expose broad whole-home data.
- Receipt metadata is saved only after user approval.

## Cost Checks

- No paid services were added.
- No Edge Functions were added.
- No cron or scheduled jobs were added.
- No realtime subscriptions were added.
- No AI/OCR/vector feature was added.
- No new storage bucket was added.
- No GitHub Actions were added.
- No external API was added.
- No hosting or production deployment was added.
- Uploaded test files are small and cleaned up when no longer needed.

## Test-User Checks

- Use one intended private MVP test account.
- Avoid repeated signup attempts.
- Confirm sign-in and sign-out work.
- Confirm signed-out demo mode remains understandable.
- Confirm a missing property does not crash the app.
- Confirm test users do not receive broad access they should not have.

## Document And Receipt Checks

- Upload a small document while signed in.
- View the document through signed access.
- Confirm no public file link is shown.
- Upload or create a receipt.
- Confirm document metadata is created for an uploaded receipt file.
- Confirm structured receipt metadata is saved only after approval.
- Cancel one receipt review flow and confirm no receipt row is created.
- Soft-delete or remove a test receipt using existing UI behavior.

## Handover And Sharing Safety Checks

- Generate a Family handover report.
- Generate a Buyer handover report.
- Confirm report generation is browser-only.
- Confirm no report file is stored.
- Confirm documents are metadata-only where expected.
- Confirm sharing review is preview-only.
- Confirm viewer, maintenance_guest, and buyer_preview previews are conservative.
- Confirm no invitation, guest account, public link, or tokenized sharing URL is created.

## Mobile Checks

- Navigation wraps and remains usable.
- Forms fit on small screens.
- Buttons do not overlap.
- Cards and lists remain readable.
- Core create/view workflows can be completed.

## Print Checks

- Open `/handover`.
- Generate a report.
- Use browser print.
- Confirm controls are hidden where expected.
- Confirm the print output does not include private file links.

## Git Checks

- Confirm current branch:

```bash
git branch --show-current
```

- Confirm status:

```bash
git status --short
```

- Review changes:

```bash
git diff --stat
git diff --check
```

- Confirm no `.env` files, build output, or secrets are staged.

## Go/No-Go Checklist

Go only if:

- Build passes.
- Security/cost audit has zero failures.
- Manual route smoke passes.
- Supabase project and storage settings are reviewed.
- Documents and receipts pass private-storage checks.
- Receipt approval-before-save is confirmed.
- Handover and sharing safety checks pass.
- No launch blocker remains open.
- Git status contains only intended files.
- The owner explicitly approves tagging the release candidate.

No-go if:

- A core route fails.
- Auth blocks private MVP testing.
- Private file access looks public.
- Receipt approval-before-save regresses.
- Any protected architecture rule is violated.
- A cost-impacting feature appears without approval.
