# Waiting on Jesse

Things I could not do for you, either because they need your credentials, your
judgement, or an account/plan you control. Kept here so nothing gets lost
between sessions.

Last updated: 2026-07-30

---

## Blocking a public launch

### 0. Enable Google / Apple sign-in (added 2026-07-31)
The "Continue with Google/Apple" buttons are hidden until you finish this —
both providers are disabled in Supabase, and clicking through used to land on
a raw JSON error page. To switch them on:

1. **Google:** Google Cloud Console → create an OAuth client (Web application);
   authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   Copy client ID + secret into Supabase → Authentication → Providers → Google.
2. **Apple** (needs the paid Apple Developer account): create a Services ID +
   Sign in with Apple key, same redirect URI, then fill Supabase → Providers → Apple.
3. Supabase → Authentication → URL Configuration → add
   `https://ourhomefolder.com/dashboard` and `https://ourhomefolder.com/reset-password`
   to Redirect URLs (Site URL should already be `https://ourhomefolder.com`).
4. In the Cloudflare Workers Builds environment set
   `NEXT_PUBLIC_OAUTH_PROVIDERS=google,apple` (or just `google`) and redeploy —
   that is what un-hides the buttons.

Password reset (forgot-password → emailed link → reset-password) works with
email/password accounts as soon as step 3's redirect URL is in place.



### 1. ~~Point the domain at a host~~ — DONE 2026-07-31
Live on Cloudflare Workers (OpenNext, PR #7). All routes verified 200 on
`ourhomefolder.com` and `www`, sitemap/canonicals emit the production URL,
MX untouched. Config: Workers Builds from `main`, root `apps/web`.

### 2. Run the signed-in flow by hand, once — IN PROGRESS
**Status: Jesse is running this pass on the live site (started 2026-07-31).
Open until Jesse explicitly says it is completed.**

Every launch blocker found in the audit lived in a signed-in flow. The
embedded browser I test in stalls inside Supabase's auth client, so I cannot
click these through for you. Now on the real site — https://ourhomefolder.com:

**Before starting:** Supabase → Authentication → URL Configuration → Site URL
`https://ourhomefolder.com`, redirect `https://ourhomefolder.com/**` (or auth
emails point at localhost).

Original checklist:
- [ ] Sign up fresh, with demo data already in the browser → the import offer
      appears on the dashboard and actually moves the rooms/utilities across.
- [ ] Sign in with no property yet → "Create a property first", **not** a raw
      Postgres error.
- [ ] Invite → accept → confirm the invited role sees only what it should.
      This flow has never once run against the live database.
- [ ] Delete account → confirm it succeeds, and that a >30-minute-old session
      is asked to re-authenticate first.
- [ ] Build a service call sheet and text/email it to yourself.

New flows shipped since the audit (2026-07-30):
- [ ] Portfolio: add a building on /portfolio, bulk-add 2–3 units, switch
      between them with the header switcher, check the roll-up counts.
- [ ] Tenancy + condition report: create a tenancy, run a move-in condition
      report with a photo, mark completed, print the deposit packet.
- [ ] Compliance: add an obligation from a template, mark it completed →
      next due date advances.
- [ ] Transfer: mint a code on /sharing (keep yourself as viewer), claim it
      on /claim with a second account → ownership moves, shares cleared,
      you retain viewer. **The single most important new check.**
- [ ] Pro: register a partner profile on /pro, re-issue a transfer → the
      claim page shows "Prepared by {business}".
- [ ] Export: Settings → Download full archive → zip contains files/ folder.
- [ ] Plate scan: add-asset → "Scan the data plate" → confirms the friendly
      "not enabled yet" message (key not set — expected).
- [ ] Seasonal plan: maintenance page → add a task as a reminder.

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

## Decisions I need before I can build the rest

Three SWOT weaknesses are researched and designed but need a call from you,
because each one crosses the line your own `docs/COST_GOVERNANCE.md` draws
around paid services, Edge Functions, cron and email.

### A. Reminders that actually fire
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

### B. Monetization
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
- **(New, 2026-07-30) Anthropic API key for the data-plate scanner.** You
  approved the vision feature; the `analyze-plate` function is deployed and
  inert until you run `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
  (create the key at console.anthropic.com). Cost ~$3–5 per 1,000 scans,
  capped server-side (30 free / 1,000 with Portfolio). Runbook §D has the
  smoke test.

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
- **Guest-role column filtering.** Contractor contacts, costs and private notes
  are filtered for guests in client-side JavaScript only. Making that a database
  guarantee needs a column-filtered view or reader function — Postgres column
  privileges are per-database-role and cannot vary by a caller's per-property
  role. Not a hole today (guests cannot reach the app UI), but it should be real
  enforcement before sharing goes public.
