# Secrets & Environment Variables Guide

**The rule in one sentence: a secret key is a credential, not configuration —
it must never reach a browser bundle, a git commit, a log line, or a chat
transcript, and the moment it does, it gets rotated, not deleted.**

Companion to `ENDPOINT_AUTH_SECURITY.md` (which depends on secrets staying
secret) and the other guides in this series.

---

## Two kinds of key

Everything below follows from never confusing these:

- **Publishable / public keys** are designed to ship to the browser: Stripe
  `pk_…`, a Supabase anon key (`sb_publishable_…` in new projects), a Google
  Maps browser key. They identify your project; the real permissions live
  behind server-side rules (Stripe dashboard settings, Supabase RLS).
- **Secret keys** are credentials: Stripe `sk_…`, a Supabase service-role key
  (`sb_secret_…`), database connection strings, Brevo/Resend/OpenAI/Anthropic
  API keys. Anyone holding one can act as you — charge cards, read every row,
  send mail from your domain, spend your credits.

The test: *"if a stranger had this string, could they do something I'd have
to clean up?"* Yes → secret.

**Supabase-specific caution:** the anon key is only "publishable" because RLS
exists. Shipping the anon key with RLS disabled on a table publishes that
table. The service-role key bypasses RLS entirely — it is a root credential
and belongs only in server environments (see `AUTHORIZATION_IDOR_SECURITY.md`).

## Where keys live

Exactly one of three places, never in committed source:

- **Locally: `.env` at the project root**, listed in `.gitignore` *before*
  the first real value is pasted. Commit a keyless `.env.example` with the
  variable names and dummy values so anyone can see what's required.
- **Hosted production: the platform's environment-variables panel** (Vercel,
  Netlify, Railway, Supabase Edge Function secrets via
  `supabase secrets set`). Pasted once, injected at build/runtime, never in
  the repo.
- **VPS: real process environment** — systemd `Environment=`, a pm2
  ecosystem file, Docker secrets, or a server-side `.env` outside the web
  root and outside git.

Validate required secrets **at boot**, not at first request — a missing
`STRIPE_SECRET_KEY` should fail the deploy, not surface as a mystery 500 (or
a silent auth bypass) later:

```typescript
// lib/env.ts — import this once at startup
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'INTERNAL_API_SECRET'] as const

for (const name of REQUIRED) {
  if (!process.env[name]) throw new Error(`Missing required env var: ${name}`)
}
```

## The prefix that makes a value public: `VITE_` / `NEXT_PUBLIC_`

Front-end frameworks hide env vars from the browser by default. The prefix is
a deliberate instruction: **"bake this value into the public JavaScript
bundle."** At build time, `import.meta.env.VITE_FOO` /
`process.env.NEXT_PUBLIC_FOO` is find-and-replaced with the literal string —
readable by anyone via View Source. There is no un-shipping it.

- `VITE_STRIPE_PUBLISHABLE_KEY` — fine, that's what the prefix is for.
- `VITE_STRIPE_SECRET_KEY` — hands your Stripe account to every visitor.

Corollaries:

- A secret's fix is never "rename it without the prefix" — the old bundle
  still exists. Rotate first, then move the logic server-side.
- `NEXT_PUBLIC_` values are inlined at **build** time: changing one requires
  a rebuild, and old deployments keep the old value forever.
- Server-only code importing an unprefixed env var is safe by default in both
  frameworks; the mistake is always adding the prefix to make an error go
  away. If the browser "needs" a secret, the design is wrong — move that call
  behind an endpoint (see `ENDPOINT_AUTH_SECURITY.md`).

### Verify what you actually shipped

```bash
# Vite
npm run build && grep -rEo "sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|sb_secret_[a-zA-Z0-9]+|service_role|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[a-zA-Z0-9-]+|AKIA[0-9A-Z]{16}" dist/ | sort -u

# Next.js
npm run build && grep -rEo "sk_live_[a-zA-Z0-9]+|sk_test_[a-zA-Z0-9]+|sb_secret_[a-zA-Z0-9]+|service_role|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[a-zA-Z0-9-]+|AKIA[0-9A-Z]{16}" .next/ | sort -u
```

Empty output = clean. Any match is public the moment the build deploys:
rotate it, then move it server-side.

## Vercel's "Sensitive" setting

A **Sensitive** env var is write-only: used at build/runtime but never
displayed again in the dashboard, CLI, or API — you can only overwrite it.

- **On** for true credentials you'll never need to read back (secret keys,
  tokens): safe from shoulder-surfing, screen shares, and hijacked dashboard
  sessions; you'd rotate rather than read anyway.
- **Off** for human-readable config you'll want to audit or tweak (admin
  email lists, FROM addresses, feature flags) — sensitive mode there just
  locks you out of your own settings.

Deciding question: *will I ever need to read this value back?* No → sensitive.

## Rotation: keys have lifespans

- **On exposure, immediately.** Bundle, commit, log, screenshot, or chat
  transcript — the key is burned. Generate a new one, update every consumer.
- **Revoke, don't delete.** Removing a leaked key from `.env` does nothing;
  the leaked copy still authenticates until you roll it in the provider's
  dashboard.
- **On offboarding and on a schedule.** Quarterly is a sane default for
  high-value keys.
- **Least privilege.** Prefer scoped keys (read-only, one bucket, restricted
  Stripe key). A scoped leak is a small fire; a root-key leak is the
  building.

### Already committed a key to git?

1. **Rotate first.** Bots scrape public GitHub for exactly this within
   minutes; nothing else matters until the leaked value is dead.
2. `git rm --cached .env` and add it to `.gitignore`.
3. The value is still in git *history* — purge with `git filter-repo` or BFG,
   but that's secondary to rotation.
4. Enable GitHub secret scanning **and push protection** so the next one is
   blocked before it lands. Optionally add `gitleaks` as a pre-commit hook —
   free, fast, catches most patterns locally:

```bash
brew install gitleaks && gitleaks git --no-banner .   # scan history
gitleaks dir --no-banner .                            # scan working tree
```

## Keep AI agents away from secret values

AI coding agents read files and print output. One will happily `cat .env` to
"understand the config" and echo live keys into the transcript — which is a
leak into that chat's logs and whatever sits behind them. Layered defence:

- `.env` and `.env.*` in `.gitignore` **and** any agent ignore file the tool
  respects (`.cursorignore`, `.aiexclude`, permission deny rules).
- A standing rule in project instructions (`CLAUDE.md`, `.cursorrules`):

```
Treat secrets as radioactive. Never read, cat, print, echo, log, or paste the
contents of .env, .env.*, or any file containing credentials. Never output the
literal value of an API key, token, password, or connection string, even while
debugging. Refer to every secret by its variable NAME only (for example
STRIPE_SECRET_KEY) and read it in code via process.env / import.meta.env. If
you believe you need a secret's value to proceed, stop and ask me instead.
```

- Reference keys by **name**, never value, in any conversation.
- Watch debugging moments — "why won't this connect?" followed by an
  environment dump is the classic slip. If a real value surfaces, rotate it.

## Checklist

- [ ] Every key classified publishable vs secret; no secret carries a `VITE_`/`NEXT_PUBLIC_` prefix
- [ ] `.env` / `.env.*` gitignored; keyless `.env.example` committed and matching what the code reads
- [ ] Required secrets validated at boot; deploys fail fast on missing values
- [ ] Production secrets only in the host's env panel / process environment — never the repo
- [ ] Production build output grepped; no secret in `dist/` or `.next/`
- [ ] Supabase: service-role key server-only; anon key public only because RLS is on everywhere
- [ ] Vercel Sensitive on for credentials, off for readable config
- [ ] Keys are least-privilege scoped; rotation happens on exposure, offboarding, and a schedule
- [ ] GitHub secret scanning + push protection enabled (gitleaks pre-commit optional but cheap)
- [ ] Agent ignore rules + the "radioactive" instruction in project docs; any key that ever touched a bundle/commit/log/chat has been rotated

## Prompt your AI assistant

```
Audit this repository for leaked or mis-scoped secrets and environment
variables. Do NOT print the actual value of any secret you find — refer to
each by variable name and file/line only.

1. Find any credential (API key, token, password, connection string, private
   key, service-role key) hardcoded as a literal in source instead of read
   from process.env / import.meta.env / Deno.env.

2. Find any secret assigned to a VITE_ or NEXT_PUBLIC_ prefixed variable, or
   otherwise reachable from client code (imported into a component, present
   in a built bundle). For each, say what it grants.

3. Confirm .env and .env.* are gitignored; scan git history for committed
   .env files or hardcoded secrets (report commit + file, not values).

4. Check a keyless .env.example exists and matches the variables the code
   actually reads; list any drift in both directions.

5. Check for boot-time validation of required env vars, and flag any code
   path where a missing secret fails open (see the endpoint-auth guide).

6. Supabase: confirm the service-role key is only referenced in server-side
   code, and never in anything with a client prefix or in the frontend
   directory.

For each finding: file and line, blast radius (what a stranger holding it
could do), and whether it requires rotation — not just removal.
```
