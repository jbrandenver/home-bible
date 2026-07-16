# Cost Governance

Home Folder is cost-aware during MVP. Cost strategy must not compromise product quality, security, or the core MVP.

The goal is not to avoid all cost. The goal is to avoid unnecessary, accidental, premature, stale, or usage-based cost.

Every implementation decision should prefer the smallest durable surface that proves the product need without creating recurring usage, background processing, duplicate infrastructure, or paid-service dependency.

## Standing Rule

Every future Codex prompt must include a Cost Impact section. If a change could add a cost that is automatic, recurring, usage-based, experimental, duplicated, or not necessary for the current phase, Codex must stop and ask for approval before implementing that part.

Never weaken security to reduce cost. Never remove RLS to simplify development. Never make private files public to reduce implementation work. Never avoid necessary schema or data-layer work just to reduce database usage. Never compromise the core user experience for small cost savings.

## Build Principles

- Every new phase must include a cost impact section before implementation.
- Avoid paid or usage-based services unless explicitly approved.
- Avoid Supabase Edge Functions unless required and approved.
- Avoid scheduled jobs and cron unless explicitly approved.
- Avoid Supabase Realtime unless required and approved.
- Avoid vector, AI, and OCR features unless explicitly approved.
- Avoid public storage buckets.
- Avoid duplicate storage buckets.
- Avoid large file uploads without explicit limits.
- Avoid keeping stale preview branches.
- Avoid unused Supabase branches.
- Avoid orphaned test data.
- Avoid unnecessary auth test users.
- Avoid excessive logs.
- Avoid automatic background processing.
- Prefer local and manual workflows until the product need is proven.
- Prefer one Supabase project and one GitHub main branch during MVP.
- Document cost risks before implementation.

## Allowed MVP Costs

Allowed without extra cost approval when they directly support a required MVP capability and remain secure, bounded, and user-triggered where applicable:

- Normal Supabase database reads and writes for core product data
- Normal private storage usage for homeowner documents and receipts
- Auth usage for real users and limited test users
- Tables, RLS policies, migrations, and metadata needed for a secure app
- Local build and test commands
- Manual user-triggered actions

## Cost Approval Required

Future phases must stop and ask for approval before implementing:

- New paid services
- New Supabase projects
- Supabase branching or preview branches
- Supabase Edge Functions
- Supabase cron or scheduled jobs
- Supabase Realtime
- AI, OCR, embeddings, or vector search
- Email, SMS, or push notifications
- Public production deployment
- GitHub Actions that run automatically
- Large file upload limit increases
- New storage buckets
- Third-party APIs
- Analytics or monitoring tools with usage billing
- Background processing
- Custom SMTP
- Paid hosting changes
- Batch processing

## Safe By Default

Allowed without extra cost approval:

- Local docs
- Local scripts that do not call paid APIs
- UI-only changes
- Supabase table changes with RLS and no background jobs when needed for the secure MVP
- Small private metadata tables
- Private storage using the existing bucket and current limits
- Manual user-triggered actions
- Build and test commands
- Git cleanup recommendations

## Decision Rule

If a cost directly supports a required MVP capability and is user-triggered, secure, and bounded, it may proceed.

If a cost is automatic, recurring, usage-based, experimental, duplicated, or not necessary for the current phase, Codex must stop and ask for approval.

## Required Cost Impact Choices

Every phase plan must choose exactly one:

- No new cost expected
- Minimal storage/database growth only
- Potential cost increase, requires user approval before implementation

If the choice is "Potential cost increase," do not implement the cost-increasing part until approval is explicit.

## Photo Storage Cost Controls (added 2026-07-13)

Photos ride the existing private `home-documents` bucket. Costs are controlled at
upload time, in the browser, with no paid services:

- **Client-side compression** (`apps/web/lib/images.ts`): images are resized to a
  1600 px maximum edge and re-encoded as JPEG (~0.82 quality) before upload. A
  typical 3 MB phone photo lands at ~250 KB (~10x storage savings). The original
  is kept only when compression does not reduce size.
- **Client-side thumbnails**: a ~240 px JPEG (~15 KB) is stored alongside each
  photo (`documents.thumbnail_path`, migration 011). Lists and galleries load
  thumbnails via batched signed URLs; the full image downloads only when opened.
  This is the primary egress control. Supabase image transformations (a paid
  Pro feature) are intentionally NOT used.
- **Hard cap**: photos over 5 MB after compression are rejected
  (`MAX_PHOTO_FILE_SIZE_BYTES`); other documents keep the 10 MB bucket cap.
- **Deletes free storage** (migration 011): deleting a document removes its file
  and thumbnail from storage via a scoped `storage.objects` DELETE policy, so
  storage no longer grows monotonically.

Budget rule of thumb with these controls: ~200 photos per home ≈ 50 MB, so the
free tier (1 GB) covers ~20 documented homes and the Pro plan's included 100 GB
covers ~2,000. Review storage and egress in the Supabase dashboard quarterly.

## Home Automation Cost Controls (added 2026-07-16)

The Home Automation module (migration `012`) adds no recurring cost:

- Manual status tracking only — no vendor APIs, no polling, no scheduled jobs.
- No new storage buckets; device/location photos reuse the existing private
  `home-documents` bucket and its compressed-upload pipeline.
- History tables (`automation_health_checks`, `automation_battery_events`,
  `automation_firmware_events`) are written only on explicit user action; keep
  only useful history and prune periodically if they grow.
- Category/protocol/ecosystem are app-validated text, so expanding the taxonomy
  needs no migration.

Future features that WOULD add recurring cost (defer until approved): live
vendor/device-cloud integrations, scheduled battery/firmware reminders, and any
always-running sync process. See `docs/HOME_AUTOMATION.md`.
