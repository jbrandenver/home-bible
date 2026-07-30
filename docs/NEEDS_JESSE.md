# Waiting on Jesse

Things I could not do for you, either because they need your credentials, your
judgement, or an account/plan you control. Kept here so nothing gets lost
between sessions.

Last updated: 2026-07-30

---

## Blocking a public launch

### 1. Point the domain at something
`ourhomefolder.com` has **no A, AAAA, or CNAME record**. Mail routes through
Cloudflare (MX records exist), but nothing serves the web. `www` does not
resolve at all.

Until this is done the app is not reachable by anyone. Also set
`NEXT_PUBLIC_SITE_URL` on the host, or staging will emit production canonical
URLs, `og:url`, and sitemap entries.

### 2. Run the signed-in flow by hand, once
Every launch blocker found in the audit lived in a signed-in flow, and
`docs/MVP_READINESS_PHASE_6M.md` has been deferring exactly this check. The
embedded browser I test in stalls inside Supabase's auth client, so I cannot
click these through for you. Worth 20 minutes in a real browser:

- [ ] Sign up fresh, with demo data already in the browser → the import offer
      appears on the dashboard and actually moves the rooms/utilities across.
- [ ] Sign in with no property yet → "Create a property first", **not** a raw
      Postgres error.
- [ ] Invite → accept → confirm the invited role sees only what it should.
      This flow has never once run against the live database.
- [ ] Delete account → confirm it succeeds, and that a >30-minute-old session
      is asked to re-authenticate first.
- [ ] Build a service call sheet and text/email it to yourself.

---

## Decisions only you can make

### 3. Delete the duplicate `.env.local` at the repo root
There are two: `/.env.local` and `/apps/web/.env.local`. Next.js only loads the
second. The root copy is dead weight that doubles the rotation surface and the
accidental-`cat` surface. Both are correctly gitignored and **nothing has
leaked** — I have not deleted it because it holds live credentials and I did not
create it.

```bash
rm "/Users/jessebranson/home Bible 1/home-bible/.env.local"
```

### 4. Install ripgrep locally
`pnpm security:audit` now refuses to run without it, instead of reporting a
pass having scanned nothing (which is what it was doing — PASS 5 / WARNING 20 /
FAIL 0 with all 13 checks skipped). CI installs it automatically; your machine
does not have it.

```bash
brew install ripgrep
```

---

## Known, deliberate, not a problem

### 5. "Leaked Password Protection Disabled" in the Security Advisor
**Ignore this on the Free plan.** It is a Pro-and-above feature, which is why
the toggle is nowhere to be found in the dashboard. The advisor still flags it
and the warning cannot be dismissed — a known Supabase catch-22.

If you upgrade: **Authentication → Sign In / Providers → Email**. Enabling it
is safe — the check blocks signup and password *changes*, but sign-in is
explicitly non-blocking, so it **cannot lock out existing users** whose password
happens to be in the breach corpus; they just get an advisory flag. The only
client work needed then is friendly copy for HTTP 422 / `weak_password` on the
signup and reset forms (branch on `reasons: ["pwned"]`, not the message text).

---

## Deferred by design — raise with me when you want them

- **Reminders do not fire.** No email, push, or cron exists. This is the single
  biggest gap versus every competitor, and it is the headline benefit of any
  paid tier, so it should land before you charge for one.
- **No analytics.** There is no funnel baseline, so any conversion or revenue
  projection is currently unfalsifiable. Instrument before forecasting.
- **No data export.** Now a trust feature in this category after Centriq's
  shutdown, and it is the substrate for the two paid one-time packs.
- **Guest-role column filtering.** Contractor contacts, costs and private notes
  are filtered for guests in client-side JavaScript only. Making that a database
  guarantee needs a column-filtered view or reader function — Postgres column
  privileges are per-database-role and cannot vary by a caller's per-property
  role. Not a hole today (guests cannot reach the app UI), but it should be real
  enforcement before sharing goes public.
