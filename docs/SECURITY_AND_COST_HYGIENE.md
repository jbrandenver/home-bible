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

- Run `git fetch --prune` periodically.
- Delete merged stale branches after merge.
- Keep Supabase preview and branch resources cleaned up.
- Check Supabase storage usage periodically.
- Keep public buckets disabled for user files.
- Remove unused Edge Functions after confirming they are not deployed or referenced.
- Review scheduled jobs before enabling them in hosted environments.

## Suggested Checks

```bash
git status
git fetch --prune
git branch --merged main
git branch -r --merged origin/main
corepack pnpm --filter @home-bible/web build
```
