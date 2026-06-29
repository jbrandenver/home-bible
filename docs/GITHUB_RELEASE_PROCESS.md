# GitHub Release Process

This process is for a local/private MVP release candidate. It does not add GitHub Actions, preview deployments, production hosting, or automated release infrastructure.

## Branch Strategy

Use `main` only during MVP unless a safety branch is needed for risky local work.

Do not create preview deployment branches unless explicitly approved.

## Check Status

```bash
git branch --show-current
git status --short
git diff --stat
git diff --check
```

Confirm:

- You are on `main`.
- Only intended files changed.
- No `.env` files are tracked.
- No build output is staged.
- No secrets are present.

## Commit

Review changes:

```bash
git diff
```

Stage intended files:

```bash
git add <file-or-directory>
```

Commit:

```bash
git commit -m "docs(release): prepare private MVP release candidate"
```

## Push

```bash
git push origin main
```

Only push after build, audit, and manual route smoke pass.

## Create A Local Safety Branch

Before risky work:

```bash
git switch -c safety/private-mvp-rc
```

Return to main:

```bash
git switch main
```

## Tag A Release Candidate Locally

Recommended tag format:

```text
v0.1.0-rc1
```

After the release-candidate commit is approved:

```bash
git tag -a v0.1.0-rc1 -m "Home Bible private MVP release candidate 1"
```

## Push A Tag

```bash
git push origin v0.1.0-rc1
```

Do not push the tag until the owner approves the release candidate.

## List Tags

```bash
git tag --list
git tag --list "v0.1.0-*"
```

View tag details:

```bash
git show v0.1.0-rc1
```

## Delete A Mistaken Local Tag

```bash
git tag -d v0.1.0-rc1
```

## Delete A Mistaken Remote Tag

Only do this after confirming the tag was pushed by mistake:

```bash
git push origin :refs/tags/v0.1.0-rc1
```

Then confirm:

```bash
git ls-remote --tags origin
```

## GitHub Actions Warning

Do not create GitHub Actions yet.

Automatic CI, preview deploys, scheduled jobs, or release automation can create accidental cost or deployment behavior and require explicit approval.

## Preview Deployment Warning

Do not create preview deployment branches or production deployment settings during MVP unless approved.

This release candidate is local/private and should remain manually controlled.
