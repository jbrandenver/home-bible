# Rollback Plan

This plan covers local/private MVP rollback. It does not make database migrations automatically reversible.

## Identify The Last Stable Commit

Use the latest commit that passed build, route smoke, and security/cost audit.

View recent history:

```bash
git log --oneline --decorate -n 20
```

Inspect a candidate commit:

```bash
git show --stat <commit-sha>
```

## Check Current Status

Before any rollback or revert:

```bash
git status --short
```

If there are uncommitted changes, decide whether to commit, stash, or copy notes before continuing.

## Create A Safety Branch Before Risky Work

Create a local safety branch:

```bash
git switch -c safety/before-risky-work
```

Return to main:

```bash
git switch main
```

This gives you a named local pointer before trying risky fixes.

## Revert A Bad Local Commit

If the bad commit has not been pushed and you want a history-preserving undo:

```bash
git revert <commit-sha>
```

Then run:

```bash
corepack pnpm --filter @home-bible/web build
corepack pnpm security:audit
```

Avoid `git reset --hard` unless you are certain no useful local work would be destroyed.

## Revert A Pushed Commit Safely

For pushed commits, prefer:

```bash
git revert <commit-sha>
git push origin main
```

This preserves shared history and is safer for collaborators.

## Avoid Force Push

Do not force-push unless absolutely necessary and explicitly approved.

Force-push can rewrite shared history and make recovery harder. If it ever becomes necessary, first create a safety branch and confirm everyone involved agrees.

## Supabase Rollback Warning

Database migrations are not automatically reversible.

- Do not drop tables to "undo" without a backup.
- Do not delete production data casually.
- Prefer forward-fix migrations.
- If a migration must be corrected, write a new migration that safely repairs the issue without data loss.
- Confirm RLS remains enabled after any migration.

## Before Future Migrations

Before applying future SQL:

- Export schema if practical.
- Confirm the migration SQL line by line.
- Confirm it does not drop production data.
- Confirm RLS policies match the existing role model.
- Apply to a test/dev project first if available in the future.
- Keep a copy of the exact SQL applied.
- Run the app build and route smoke after migration.

## Emergency Checklist

1. Stop changing code.
2. Capture the error, route, command, and timestamp.
3. Run `git status --short`.
4. Identify the last stable commit with `git log --oneline --decorate -n 20`.
5. Create a safety branch if local changes exist.
6. Revert the bad commit if it is code-only.
7. Do not manually delete database data to recover UI behavior.
8. If database state is involved, export relevant data before any repair.
9. Prefer a forward-fix migration.
10. Re-run build, audit, and route smoke.
