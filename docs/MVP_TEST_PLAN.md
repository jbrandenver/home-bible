# Private MVP Test Plan

## Purpose

The private MVP test validates whether Home Bible helps a real homeowner collect, organize, retrieve, and safely hand over practical home knowledge before more features are added.

This test is manual and private. It should use existing Supabase auth, existing tables, existing RLS, and existing private storage only.

## First Testers

Start with:

- The product owner or builder
- One trusted homeowner who can give detailed feedback
- One technically comfortable tester who can report reproduction steps clearly

Do not invite broad testers until the launch-blocker criteria below are clear.

## Test Environment

- Use the local web app or the approved private test environment only.
- Use a modern desktop browser first, then repeat key checks on mobile.
- Keep test files small.
- Delete unneeded test files after document and receipt testing.
- Do not add real secrets, security credentials, private entry details, or sensitive household instructions.

## Test Account

Use either:

- A real signed-in test account created through `/sign-up`
- Demo mode for signed-out exploratory testing

Do not create fake accounts automatically. Do not trigger repeated signup attempts. If auth is rate-limited, pause and retry later.

## Recommended Sample Home

Use the manual seed walkthrough in `docs/MVP_SEED_WALKTHROUGH.md`.

The sample should include one property, a handful of rooms, major utilities, common assets, reminders, repairs, service history, issues, documents, receipts, Home Handover reports, and Sharing & Access Review checks.

## Homeowner Walkthrough

1. Sign up or sign in.
2. Create a property with address skipped.
3. Add rooms and floors.
4. Add core utilities and verify locations are understandable.
5. Add major assets and warranty details.
6. Add reminders for recurring maintenance.
7. Add repairs and service records.
8. Add issues and trend flags where relevant.
9. Upload a few small private documents.
10. Upload receipt files and approve structured receipt metadata before saving.
11. Review dashboard summaries.
12. Open room, asset, utility, repair, and issue detail pages.
13. Generate Home Handover reports in the browser.
14. Review Sharing & Access Review roles.
15. Repeat core navigation and review on a mobile viewport.

## Success Looks Like

- Tester can understand the app without coaching.
- Property setup takes only a few minutes.
- Core pages have useful empty states and clear actions.
- Documents and receipts feel private and controlled.
- Receipt metadata is saved only after approval.
- Handover reports are useful and do not expose private file access.
- Sharing review is clearly preview-only.
- Mobile navigation is usable.
- No tester sees confusing internal identifiers in normal flows.

## Failure Looks Like

- Tester cannot complete onboarding.
- A key route crashes or shows a blank page.
- A save action silently fails.
- Private file access appears public.
- Receipt data is saved before review approval.
- Handover or sharing previews expose unsafe detail.
- Demo mode and signed-in mode behave inconsistently without explanation.
- Mobile navigation blocks key actions.

## Security Watch List

- Never enter secrets, private entry details, household security credentials, or sensitive access instructions.
- Confirm private files remain private.
- Confirm document viewing uses signed access only.
- Confirm no public file links appear.
- Confirm RLS remains enabled after migrations.
- Confirm viewer-style previews are read-only.
- Confirm maintenance-style previews do not expose broad whole-home information.

## Cost Watch List

- No paid services should be added.
- No Edge Functions, scheduled jobs, realtime, AI/OCR/vector features, or background processing should be enabled.
- No new storage buckets should be created.
- Keep test files small.
- Delete unneeded uploaded test files.
- Avoid repeated auth-test-user creation.
- Keep testing manual and user-triggered.

## Feedback Questions

- What were you trying to accomplish?
- What felt immediately useful?
- Where did you hesitate?
- Which labels or screens were confusing?
- Did you trust the privacy model?
- Did document and receipt handling feel safe?
- Was the handover report useful enough to print or share manually?
- Which missing feature blocked real use?
- Which feature can wait?
- Would you keep using this for your own home?

## Launch-Blocker Criteria

Treat as launch blockers:

- Build failure
- Core route failure
- Auth prevents basic signed-in testing
- Property onboarding failure
- Inability to create or view core records
- Private file exposure risk
- Receipt approval-before-save regression
- Handover report crash
- Sharing page implies real sharing is enabled
- Mobile navigation unusable for core workflows
- Any security or cost-governance violation

## Nice-To-Have Criteria

Track but do not block private MVP unless severe:

- Minor copy improvements
- Small layout polish
- Faster data entry
- More examples
- More filters or sorting
- Better print styling
- Import/export conveniences
- Bulk editing

## Private MVP Exit Criteria

Exit private MVP prep when:

- Build passes.
- Security/cost audit has zero failures.
- Manual route smoke passes.
- One signed-in test property has realistic sample data.
- Documents and receipts are tested with private storage.
- Handover and sharing previews are reviewed.
- At least one trusted tester completes the walkthrough.
- Launch blockers are fixed or explicitly deferred with owner approval.
