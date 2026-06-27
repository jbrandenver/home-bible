# Phase Template

Use this template for every future Codex phase.

## Phase Name

<!-- Name the phase. -->

## Goal

<!-- State the outcome in one or two sentences. -->

## Scope

<!-- List what this phase will change. -->

## Explicitly Out Of Scope

<!-- List what must not be changed. -->

## Protected Architecture Rules

- Do not remove Supabase.
- Do not bypass RLS.
- Do not expose service role keys.
- Do not store private user files in public buckets.
- Do not save parsed receipt data before user approval.
- Do not add cost-impacting services without explicit approval.

## Security Impact

<!-- Describe auth, RLS, storage, secret, and data-sensitivity impact. -->

## Cost Impact

Choose exactly one:

- [ ] No new cost expected
- [ ] Minimal storage/database growth only
- [ ] Potential cost increase, requires user approval before implementation

Notes:

<!-- Document the reasoning and any approval needed. -->

## Supabase Resources Touched

<!-- Tables, policies, migrations, buckets, auth settings, functions, branches, or none. -->

## GitHub Resources Touched

<!-- Actions, branches, repository settings, or none. -->

## Storage Impact

<!-- Buckets, file limits, file types, retention, or none. -->

## Background Job Impact

<!-- Cron, scheduled jobs, queues, batch processing, or none. -->

## AI/OCR/Vector Impact

<!-- AI, OCR, embeddings, vector search, parsing, or none. -->

## Realtime Impact

<!-- Channels, subscriptions, broadcast, presence, or none. -->

## Test Data Impact

<!-- Seed data, test users, local-only fixtures, cleanup plan, or none. -->

## Rollback Plan

<!-- Explain how to revert safely without deleting production data. -->

## Testing Checklist

- [ ] Build passes
- [ ] Affected routes load
- [ ] RLS remains enabled where relevant
- [ ] Private files still use signed URLs where relevant
- [ ] No new cost-impacting resources were added without approval

## Commit Message

```text
type(scope): short summary
```
