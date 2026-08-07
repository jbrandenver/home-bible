# Waiting on Jesse

Things I could not do for you, either because they need your credentials, your
judgement, or an account/plan you control. Kept here so nothing gets lost
between sessions.

Last updated: 2026-08-05

**Read `docs/LAUNCH_CHECKLIST.md` first** — it is the live list and is kept
current. This file holds the long-form reasoning behind each ask. As of
2026-08-05: the site is launched, money is live AND purchase-tested with a
real card, the full manual QA pass is COMPLETE (see checklist below), the
plate scanner is live, the sitemap is submitted to Search Console, and the
Cloudflare CSP question is investigated with a scheduled 9am verdict. What
is genuinely left: the CPA digital-goods tax question, the Supabase
leaked-password toggle (item 5), and three scheduled follow-ups (CSP
verdict Aug 5, DMARC tightening Aug 18, cancel test subscription Sep 1).

---

## Blocking a public launch

### 0. ~~Enable Google sign-in~~ — DONE 2026-08-01
"Continue with Google" is live on `/sign-in` and `/sign-up`. Verified:
Supabase reports `google: true`, and the button renders in production.

Setup, for reference if it ever needs redoing:

1. **Google Cloud Console** → OAuth client (Web application). Authorized
   **redirect URI** (the field with a path):
   `https://gdntnlhnjyyzxcjuypuy.supabase.co/auth/v1/callback`.
   Authorized **JavaScript origins** takes origins only — no path, no
   trailing slash — and is optional for this flow. Client ID + secret go into
   Supabase → Authentication → Providers → Google.
2. Supabase → Authentication → URL Configuration → Redirect URLs include
   `https://ourhomefolder.com/dashboard` and
   `https://ourhomefolder.com/reset-password`.
3. Cloudflare Workers Builds **build** variables (not runtime — `NEXT_PUBLIC_*`
   is inlined at build time): `NEXT_PUBLIC_OAUTH_PROVIDERS=google`, then
   redeploy.

**Sign in with Apple was removed (2026-08-01, founder ruling).** It needs a
paid Apple Developer account, and Apple's requirement to offer it alongside
other social logins applies to iOS apps, not web apps. If a native iOS app
ships later, Apple sign-in becomes mandatory there — re-adding it means the
provider in Supabase plus restoring the `'google' | 'apple'` union in
`apps/web/lib/auth.ts` and a second button on both auth pages.

Password reset (forgot-password → emailed link → reset-password) works with
email/password accounts as soon as step 3's redirect URL is in place.



### 1. ~~Point the domain at a host~~ — DONE 2026-07-31
Live on Cloudflare Workers (OpenNext, PR #7). All routes verified 200 on
`ourhomefolder.com` and `www`, sitemap/canonicals emit the production URL,
MX untouched. Config: Workers Builds from `main`, root `apps/web`.

### 2. ~~Run the signed-in flow by hand, once~~ — COMPLETED 2026-07-31
Jesse ran the full pass on the live site and confirmed it works.
(Checklist retained below for future regression passes.)

Original heading: Run the signed-in flow by hand, once
**Status: Jesse is running this pass on the live site (started 2026-07-31).
Open until Jesse explicitly says it is completed.**

Every launch blocker found in the audit lived in a signed-in flow. The
embedded browser I test in stalls inside Supabase's auth client, so I cannot
click these through for you. Now on the real site — https://ourhomefolder.com:

**Before starting:** Supabase → Authentication → URL Configuration → Site URL
`https://ourhomefolder.com`, redirect `https://ourhomefolder.com/**` (or auth
emails point at localhost).

Original checklist:
- [x] Sign up fresh, with demo data already in the browser → the import offer
      appears on the dashboard and actually moves the rooms/utilities across.
      — Fixed and exercised 2026-08-04 (demo import now creates the home).
- [x] Sign in with no property yet → "Create a property first", **not** a raw
      Postgres error. — Covered by the 2026-08-04 guardedRead/session fixes
      and exercised across the QA pass's fresh accounts.
- [x] Invite → accept → confirm the invited role sees only what it should.
      — VERIFIED 2026-08-04/05: full E2E with a second account (invite →
      email → address-locked accept → viewer gating → revoke → "Access
      removed"); guest-column enforcement verified at the data layer 6/6.
- [x] Delete account → confirm it succeeds, and that a >30-minute-old session
      is asked to re-authenticate first. — VERIFIED 2026-08-05: the 401 →
      re-sign-in → 200 sequence appears in the function logs; erasure
      confirmed forensically clean (auth user, profile, memberships,
      invitation refs all gone).
- [x] Build a service call sheet and text/email it to yourself.
      — VERIFIED 2026-08-05: text, print, and email all received.

New flows shipped since the audit (2026-07-30):
- [x] Portfolio: add a building on /portfolio, bulk-add 2–3 units, switch
      between them with the header switcher, check the roll-up counts.
      — VERIFIED 2026-08-05 (building + 4 units), including a REAL $29
      Portfolio purchase proving checkout → webhook → entitlement. Found and
      fixed: switcher didn't re-list after creates.
- [x] Tenancy + condition report: create a tenancy, run a move-in condition
      report with a photo, mark completed, print the deposit packet.
      — VERIFIED 2026-08-05: two tenancies + two completed move-in reports.
- [x] Compliance: add an obligation from a template — VERIFIED 2026-08-05
      (two obligations added from templates). Completed-→-due-date-advance
      not separately exercised yet.
- [x] Transfer: mint a code on /sharing (keep yourself as viewer), claim it
      on /claim with a second account → ownership moves, shares cleared,
      you retain viewer. **The single most important new check.**
      — VERIFIED WORKING by Jesse 2026-08-03 (after same-day fixes: claim
      discoverability on welcome/dashboard, sharing card layout).
- [x] Pro: register a partner profile on /pro, re-issue a transfer → the
      claim page shows "Prepared by {business}". — VERIFIED 2026-08-03.
- [x] Export: Settings → Download full archive → zip contains files/ folder.
      — VERIFIED 2026-08-05; evidence recorder correctly silent for a free
      account (no entitlement to evidence).
- [x] Plate scan: add-asset → "Scan the data plate" — better than the
      original ask: the key is set and a REAL scan succeeded 2026-08-05
      (Claude vision call 200 in ~7s, scan recorded against the account cap).
- [x] Seasonal plan: maintenance page → add a task as a reminder.
      — VERIFIED 2026-08-05 (three tasks). Found and fixed: the plan
      re-offered and duplicated already-added tasks.

---

## Decisions only you can make

### 3. ~~Delete the duplicate `.env.local` at the repo root~~ — DONE 2026-08-03
Deleted with Jesse's go-ahead; `apps/web/.env.local` (the one Next.js loads)
untouched. Item 4 (ripgrep) also done the same day — `pnpm security:audit`
now genuinely runs: PASS 9 / WARNING 16 / FAIL 0.

Original item, for the record:

### 3-old. Delete the duplicate `.env.local` at the repo root
There are two: `/.env.local` and `/apps/web/.env.local`. Next.js only loads the
second. The root copy is dead weight that doubles the rotation surface and the
accidental-`cat` surface. Both are correctly gitignored and **nothing has
leaked** — I have not deleted it because it holds live credentials and I did not
create it.

```bash
rm "/Users/jessebranson/home Bible 1/home-bible/.env.local"
```

### 4. ~~Install ripgrep locally~~ — DONE 2026-08-03
`pnpm security:audit` now genuinely runs: PASS 9 / WARNING 16 / FAIL 0.

Original item:

### 4-old. Install ripgrep locally
`pnpm security:audit` now refuses to run without it, instead of reporting a
pass having scanned nothing (which is what it was doing — PASS 5 / WARNING 20 /
FAIL 0 with all 13 checks skipped). CI installs it automatically; your machine
does not have it.

```bash
brew install ripgrep
```

---

## Known, deliberate, not a problem

### 5. ~~"Leaked Password Protection Disabled" — ignore on Free~~ — NO LONGER TRUE
**This is now actionable and should be turned on.** The project moved to
**Pro on 2026-08-03**, so the toggle exists. The advisor still reports it
disabled as of 2026-08-04. Instructions below stand.

Original item, for the record — **Ignore this on the Free plan.** It is a
Pro-and-above feature, which is why the toggle is nowhere to be found in the
dashboard. The advisor still flags it and the warning cannot be dismissed — a
known Supabase catch-22.

Enabling it: **Authentication → Sign In / Providers → Email**. Enabling it
is safe — the check blocks signup and password *changes*, but sign-in is
explicitly non-blocking, so it **cannot lock out existing users** whose password
happens to be in the breach corpus; they just get an advisory flag. The only
client work needed then is friendly copy for HTTP 422 / `weak_password` on the
signup and reset forms (branch on `reasons: ["pwned"]`, not the message text).

---

## Decisions I need before I can build the rest

Three SWOT weaknesses are researched and designed but need a call from you,
because each one crosses the line your own `docs/COST_GOVERNANCE.md` draws
around paid services, Edge Functions, cron and email.

### A. ~~Reminders that actually fire~~ — DONE, LIVE since 2026-08-03
Digest ships on pg_cron → Edge Function → Resend from send.ourhomefolder.com;
retry window + fail-open fixes landed 2026-08-04 (migration 039). Original
design notes below, for the record.

Original item:

### A-old. Reminders that actually fire
Recommended: **weekly** digest — `pg_cron` → `pg_net` → Edge Function → Resend,
sending from `send.ourhomefolder.com`. **$0** at your scale.

What I need from you:
- Approval for **two Edge Functions** (send-digest, unsubscribe) and pg_cron.
- A **Resend account** (free, no card) and its API key.
- **DNS records** on the send subdomain: SPF, DKIM, MX, plus DMARC on the apex.
- A **postal address for the email footer**. CAN-SPAM requires one. Do not use
  your home address — a PO box or virtual mailbox is ~$10-20/mo and is the only
  genuinely unavoidable cost here.

Why weekly, not daily: Resend's free tier caps at **100 emails/day**, so a daily
digest hits the ceiling at exactly 100 users. Weekly also suits home
maintenance, and fewer, denser sends protect deliverability.

### B. ~~Monetization~~ — DONE, LIVE and PURCHASE-TESTED
Stripe activated 2026-08-03; webhook battery green; entitlements wired; the
full chain was proven with a REAL $29 Portfolio purchase on 2026-08-05
(checkout → webhook → entitlement active in under a second). Plate scanner
key set 2026-08-04 and live-verified 2026-08-05. Remaining from this
section: only the CPA state-tax question (still open — sell US-only until
answered). Original design notes below, for the record.

Original item:

### B-old. Monetization
Recommended: **raw Stripe, US-only at first, Payment Links** (zero checkout
code) → one webhook Edge Function → an `entitlements` table with **no write
policies at all**. ~3 focused days.

What I need from you:
- Approval for **one more Edge Function** and for **Supabase Pro ($25/mo)** on
  the day you go live — free projects pause when idle, and a paused project
  means someone pays and gets nothing.
- A **Stripe account**.
- A **CPA's view** on whether your state taxes digital products. I deliberately
  did not research state tax rules; a wrong answer there costs real money.
- **(New, 2026-07-30)** When you create the Stripe account, also create the
  **Portfolio plan** recurring price (suggested $29/mo) alongside the two
  one-time packs, and set `NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK` on the
  web host. Steps and pricing rationale: docs/ACTIVATION_RUNBOOK.md §B and
  docs/PORTFOLIO.md. Until then the landlord features run ungated on purpose.
  A third Payment Link (`pro_binder`, one-time, $15–25) covers the pro
  channel — same section of the runbook.
- ~~**(New, 2026-07-30) Anthropic API key for the data-plate scanner.**~~
  **DONE — key set, verified 2026-08-06.** `plate_scans` holds a `status='ok'`
  row from 2026-08-05 01:12 UTC, which is only written after a successful
  vision call; the inert function 503s long before that insert. Scanning is
  live. Cost ~$3–5 per 1,000 scans, capped server-side (30 free / 1,000 with
  Portfolio).

Two things worth knowing before you commit:
- Selling **US-only avoids EU/UK VAT entirely**, which has no de-minimis
  threshold for digital goods. The day you want international buyers, switch to
  a merchant-of-record (Paddle or Lemon Squeezy) — that is a checkout swap, not
  an architecture change.
- **The paywall cannot be cryptographic.** The Handover Pack is generated in the
  browser from data the user already owns and can legitimately read, so the gate
  is a client-side check backed by an entitlements table, not an enforced
  boundary. That is a normal way to sell formatting and convenience, and the
  realistic bypass rate for a homeowner at a closing is nil — but you should
  know it rather than discover it. Moving generation into an Edge Function later
  closes it properly.

### C. Analytics beyond the baseline
**Already done and needs nothing from you:** `metrics.signup_funnel`,
`metrics.activation` and `metrics.write_retention` now compute your funnel from
existing rows, retroactively, service-role only. Query them in the SQL editor.

Optional next step, if the SQL stops answering your questions: a small
first-party event table for what leaves no row behind (drop-off inside a form,
errors, pre-signup traffic). Still $0 and still no third-party script. I would
**not** add GA4 — it forces a cookie banner and puts a tracker on pages showing
someone's private home record, which contradicts the whole positioning.
- **Native mobile app.** Deferred until the web app is ready, per your call. The
  cheap bridge in the meantime is a PWA (installable, works offline, and is the
  only way to get push on iOS — Safari requires the app be added to the Home
  Screen). It is also the substrate the native build would reuse.
- **Guest-role column filtering.** ~~Client-side only~~ — since migrations
  031/033 (2026-08-03/04) this IS a database guarantee: column grants +
  private-fields RPCs enforce it server-side, verified for a second account
  in rolled-back impersonation tests (6/6) on 2026-08-04.
