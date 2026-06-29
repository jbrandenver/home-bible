# Supabase Backup And Usage Checklist

Use this before a private MVP release candidate and before future migrations. This is a manual dashboard checklist, not automation.

## Project Usage

In the Supabase dashboard:

1. Open the intended Home Bible project.
2. Review project usage and billing/usage indicators.
3. Confirm usage looks expected for private MVP testing.
4. Confirm there are no unexpected services enabled.

## Database Size

1. Open database usage or project usage views.
2. Review database size.
3. Confirm growth matches expected manual test data.
4. Investigate unexpected spikes before adding testers.

## Storage Usage

1. Open Storage.
2. Review total storage usage.
3. Review object counts if available.
4. Confirm test uploads are small and intentional.
5. Delete unneeded test uploads manually only when safe.

## Auth Users

1. Open Authentication users.
2. Confirm only intended test users exist.
3. Remove unused test users only after confirming they are not needed.
4. Avoid repeatedly creating new test users.

## Logs

1. Review recent Auth, API, Database, and Storage logs if available.
2. Look for repeated errors, failed auth loops, or unexpected storage activity.
3. Do not enable new paid monitoring or external logging without approval.

## Storage Buckets

1. Open Storage buckets.
2. Confirm `home-documents` exists.
3. Confirm `home-documents` is private.
4. Confirm no user-file bucket is public.
5. Confirm no extra buckets were created by accident.

## Public Bucket Review

There should be no public bucket for homeowner files.

If a bucket appears public:

1. Stop testing.
2. Do not upload additional files.
3. Confirm whether any private files were exposed.
4. Make the bucket private or apply a safe corrective migration/policy after review.

## Edge Functions

1. Open Edge Functions.
2. Confirm no unused function is deployed.
3. Confirm no new function was added for the release candidate.
4. Do not deploy functions without explicit approval.

## Preview Branches

1. Review Supabase branch or preview project settings.
2. Confirm no stale preview branches exist.
3. Do not create a new Supabase project or preview branch without approval.

## Manual Table Export

If a manual export is needed:

1. Open Table Editor.
2. Select the table.
3. Use Supabase dashboard export/download options if available.
4. Save exports in a secure local location.
5. Do not commit exported data to Git.
6. Do not share exports with testers unless explicitly approved.

Consider exporting small private MVP tables before risky migration work, especially:

- properties
- floors
- rooms
- utilities
- assets
- reminders
- repairs
- service_records
- issues
- trend_flags
- documents
- receipts

## Test File Hygiene

- Keep test file sizes small.
- Prefer placeholder PDFs or images.
- Delete unneeded test uploads manually only when safe.
- Do not delete homeowner production data casually.
- Confirm document and receipt rows still make sense after file cleanup.

## Final Supabase Go/No-Go

Go only if:

- Intended project is selected.
- Usage looks expected.
- Auth users are intentional.
- Storage usage is expected.
- `home-documents` is private.
- No public user-file bucket exists.
- No unexpected Edge Functions, scheduled jobs, realtime usage, preview branches, or extra buckets exist.
