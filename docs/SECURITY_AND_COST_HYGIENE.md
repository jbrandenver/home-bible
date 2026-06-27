# Security and Cost Hygiene

Use this checklist before commits, after migrations, and during periodic project cleanup.

## Security

- Never commit `.env` files.
- Never use a Supabase service role key in frontend code.
- Keep frontend Supabase access limited to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Keep user file buckets private.
- Use signed URLs for private user file viewing and downloads.
- Confirm RLS is enabled after every migration.
- Confirm viewers remain read-only after policy changes.
- Confirm maintenance guests do not get whole-home access.
- Do not store sensitive home access details in app data.
- Run `git status` before every commit.

## Cost Hygiene

- Cost strategy must not compromise product quality, security, or the core MVP.
- Avoid unnecessary, accidental, premature, stale, or usage-based cost; do not avoid all necessary MVP cost.
- Run `git fetch --prune` periodically.
- Delete merged stale branches after merge.
- Keep Supabase preview and branch resources cleaned up.
- Check Supabase storage usage periodically.
- Keep public buckets disabled for user files.
- Remove unused Edge Functions after confirming they are not deployed or referenced.
- Review scheduled jobs before enabling them in hosted environments.

## Standing Cost Review

### Before Each Phase

- Add a Cost Impact section to the phase prompt or plan.
- Identify Supabase, GitHub, storage, email, AI, OCR, logs, background-job, and hosting cost risks.
- Stop for approval before adding anything from the Cost Approval Required list in `docs/COST_GOVERNANCE.md`.

### During Implementation

- Prefer local docs, local scripts, manual user-triggered actions, and existing private storage.
- Avoid background processing, realtime, new buckets, and paid services unless already approved.
- Allow required MVP database reads/writes, private storage, auth, tables, RLS policies, migrations, and metadata when they are secure and bounded.
- Never weaken RLS, make private files public, skip necessary schema work, or degrade the core user experience to reduce cost.
- Keep file sizes and storage usage within current limits.

### Before Commit

- Run `git status`.
- Confirm no `.env` files, secrets, service role keys, or generated build output are staged.
- Confirm expected cost impact is documented.
- Run the local audit script when practical.

### Before Push

- Confirm the branch is intentional.
- Run `git fetch --prune` when reviewing remote branch hygiene.
- Confirm no new GitHub Actions or preview resources were added accidentally.

### After Supabase Migration

- Confirm RLS is enabled on new exposed tables.
- Confirm viewers remain read-only.
- Confirm maintenance guests do not get broad whole-home access.
- Confirm no public bucket or background job was created accidentally.

### Monthly Maintenance

- Review Supabase preview branches and delete stale ones only after confirming they are safe.
- Review storage usage, bucket list, auth test users, Edge Functions, and scheduled jobs.
- Prune stale Git remote-tracking branches.
- Re-run `scripts/security-cost-audit.sh`.

## Suggested Checks

```bash
git status
git fetch --prune
git branch --merged main
git branch -r --merged origin/main
corepack pnpm --filter @home-bible/web build
```
