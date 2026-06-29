# Manual QA Checklist

Use this checklist for private MVP testing. Mark each item pass, fail, or not tested.

## Auth

- `/sign-up` explains account creation clearly.
- `/sign-in` explains sign-in clearly.
- Email/password errors are readable.
- Rate-limit guidance is helpful.
- Sign-out works from settings and navigation.
- Signed-out users can use demo mode where expected.

## Property Onboarding

- `/create-property` loads.
- Property nickname is required.
- Address is optional and can be skipped.
- Property saves in signed-in mode.
- Property saves locally in demo mode.
- `/add-rooms` loads after property creation.
- Rooms can be added.
- Duplicate submit clicks are prevented.

## Dashboard

- `/dashboard` loads with no property.
- Dashboard explains demo versus signed-in behavior.
- Dashboard counts and summaries are readable.
- Dashboard links reach major routes.
- No internal ids appear in normal summary UI.

## Home Map

- `/home-map` loads.
- Empty state is understandable.
- Rooms link to detail pages.
- Mobile layout is usable.

## Rooms

- `/rooms/[id]` handles missing records gracefully.
- Linked utilities, assets, repairs, issues, reminders, documents, and receipts display safely.
- Return navigation is clear.

## Utilities

- `/utilities` loads.
- Utility create/edit flow validates required fields.
- `/utilities/[id]` handles missing records gracefully.
- Linked records are readable.

## Assets

- `/assets` loads.
- Asset create/edit flow validates required fields.
- `/assets/[id]` handles missing records gracefully.
- Warranties, documents, receipts, repairs, and issues are linked safely.

## Warranties

- `/warranties` loads.
- Warranty states are readable.
- Warranty links to assets and documents work.
- External manual/support links are clearly user-entered links.

## Reminders

- `/reminders` loads.
- Reminder create/edit validates required fields.
- Reminder statuses and priorities are readable.
- Empty state is helpful.

## Repairs

- `/repairs` loads.
- Repair create/edit validates required fields.
- `/repairs/[id]` handles missing records gracefully.
- Service records and linked issues are readable.

## Issues

- `/issues` loads.
- Issue create/edit validates required fields.
- `/issues/[id]` handles missing records gracefully.
- Trend flag behavior is understandable.

## Documents

- `/documents` loads.
- Signed-out users receive a sign-in prompt for upload.
- Upload requires signed-in mode.
- Files stay private.
- Viewing documents uses signed access.
- No public file links are shown.
- Delete behavior is clear.

## Receipts

- `/receipts` loads.
- Receipt upload creates document metadata first.
- Receipt structured metadata is saved only after approval.
- Canceling review does not create a receipt row.
- Delete uses the existing safe behavior.
- Receipt document viewing uses signed access.

## Home Handover

- `/handover` loads.
- Report options are clear.
- Family report generates.
- Buyer report generates.
- Print works from the browser.
- No report file is stored.
- No public share link is created.
- Documents and receipts are metadata-only where appropriate.

## Sharing

- `/sharing` loads.
- Role selector works.
- viewer preview is read-only.
- maintenance_guest preview is restricted.
- buyer_preview hides private financial receipt details by default.
- insurance_view does not expose public file links.
- Page clearly says sharing is preview-only.

## Settings

- `/settings` loads.
- Signed-in account state is shown.
- Demo mode state is shown when signed out.
- Security and privacy reminders are clear.
- MVP test checklist link works.

## MVP Test Page

- `/mvp-test` loads.
- It shows signed-in versus demo mode.
- It does not create seed data automatically.
- It links to key routes.
- It explains no-cost/no-background behavior.

## Mobile Checks

- Navigation wraps and remains usable.
- Forms fit on small screens.
- Buttons do not overlap.
- Cards and lists remain readable.

## Print Checks

- Home Handover print output is readable.
- Print hides setup controls.
- Printed report does not include private file links.

## Signed-Out Demo Checks

- Demo mode is clearly labeled.
- Demo property and rooms can be created.
- Demo data does not imply cloud persistence.
- Signed-in prompts appear where cloud-only behavior is required.

## Security Checks

- No service role key appears in frontend code.
- No public file links appear for private files.
- Private storage remains private.
- RLS remains enabled in migrations.
- Testers are not asked to enter secrets or sensitive access instructions.
- Sharing and handover outputs remain conservative.

## Cost Checks

- No Edge Functions were added.
- No scheduled jobs were added.
- No realtime subscriptions were added.
- No AI/OCR/vector feature was added.
- No new storage bucket was added.
- No public bucket was added.
- No GitHub Actions were added.
- No external API was added.
- No seed data runs automatically.
- Uploaded test files are small and cleaned up when no longer needed.
