# Session handoff — Our Home Folder

> **⚠️ SUPERSEDED — this document describes the world of 2026-07-30, before
> launch.** It is kept because its narrative of *how* things broke (the
> duplicate migration `010`, the proven privilege escalation, the reasoning
> behind the digest cadence) is still the best explanation of why the code
> looks the way it does. **Do not read its "WHAT IS LEFT" section as current.**
>
> For current state, read in this order:
> 1. `docs/LAUNCH_CHECKLIST.md` — the live open-items list.
> 2. `docs/SECURITY.md` — the security posture and the dashboard-only settings.
> 3. `docs/NEEDS_JESSE.md` — long-form reasoning behind what needs the founder.
>
> **What changed since this was written:** the site launched on
> `ourhomefolder.com` (Cloudflare Workers Builds from `main`); Supabase is on
> **Pro**, not Free; Stripe is **live** with three Payment Links and a
> signature-verifying webhook; reminder emails are **live** through Resend on
> `send.ourhomefolder.com`; the PWA layer shipped; the marketing landing page
> and `/pricing` shipped; guest-role column filtering is **DB-enforced** now,
> not client-side (migrations 031/033); the paid property boundary is enforced
> by a Postgres trigger (035); an audit trail and a daily security digest are
> running (035); and the CSP is **enforcing**. Migrations run to **037**.

Written 2026-07-30 at the end of a long working session.

---

## Where things are

| | |
|---|---|
| **Repo** | `~/home Bible 1/home-bible` (pnpm monorepo) |
| **Web app** | `apps/web` — Next.js 14, **Pages Router**, TypeScript |
| **Shared code** | `packages/shared` (Zod + helpers), `packages/ui` |
| **Supabase project** | ref `gdntnlhnjyyzxcjuypuy`, named "Home-bible", **Free plan** |
| **Domain** | `ourhomefolder.com` — owned, **no web DNS record yet** |
| **Dev server** | `preview_start` with `home-folder-web` (port 3055), configured in the `.claude/launch.json` of `~/Documents/New project` |
| **Branch** | `fix/pre-launch-audit-remediation` → **PR #5 open** |
| **Tests** | 68 passing across 10 files (`pnpm --filter @home-folder/web test`) |

**Architecture constraint that shapes everything:** the browser talks *directly*
to Postgres via supabase-js. There is no server API layer. So **RLS is the only
enforcement boundary**, and anything needing a secret has to be an Edge Function.

### Migration workflow — important
Migrations are named `001_…`–`022_…`, which the Supabase CLI cannot match against
the remote ledger's timestamp versions. **`supabase db push` is unsafe here** —
it would try to re-run `001`. Use instead:

```bash
supabase db query --linked -f <file>     # wrap the file in begin; … commit;
```
then insert a row into `supabase_migrations.schema_migrations` by hand. Always
dry-run first with `begin; … rollback;`.

---

## What happened this session, in order

### 1. Two features built
- **Nav section menus** — Dashboard and More tabs got dropdown jump menus
  (desktop chevron + mobile bottom sheet) to anchored page sections.
- **Outdoor utility locations** — "Room" became "Location" on utility forms,
  with presets (back yard, north side of house, garage…) that create real room
  records on save.
- **Share with a technician** — the Service Call Sheet gained pre-addressed
  Text/Email, a scheduled visit (date + arrival window), a property address
  editor with a privacy toggle, and a "Report a problem" entry point on utility
  pages.
- Merged as **PR #4** → `acab59c`.

### 2. A comprehensive audit
Full report published as an artifact:
**https://claude.ai/code/artifact/867f2839-c80d-4e34-8fc9-1478f4622f23**

Five parallel agents (RLS/IDOR, endpoint auth + secrets, injection/XSS,
logic/correctness, product+market) plus direct inspection of the **live**
database. Tally: 2 Critical, 9 High, 14 Medium, 17 Low, 40+ verified clean.

**The headline finding was deployment drift, not bad code.** Two migration files
shared the number `010`; the security one had never been applied. Consequences:

- A **proven privilege escalation** — an invited editor could rewrite
  `properties.owner_user_id` to themselves, self-promote, and evict the real
  owner. Demonstrated in a rolled-back transaction.
- **Sharing/invitations were dead** in production (tables did not exist).
- **Account deletion was dead** (zero Edge Functions were deployed).

Critically, applying migration `010` as written would have introduced a *worse*
hole: its invitation UPDATE policy had an `or accepted_by = auth.uid()` branch
that never checked `property_id`.

### 3. All audit findings fixed
- `dbb7716` — security. Patched and applied the security migration as `015`,
  added guard triggers, closed a sign-in open redirect (`?next=` →
  `javascript:` sink), made `created_by`/visibility immutable, stopped guest
  roles reading smart-home network credentials, fixed a CI gate that reported
  PASS while scanning nothing, deployed + hardened `delete-account`.
- `0eaa481` — correctness blockers. Signup no longer silently destroys demo
  data (real import added), the add-rooms RLS crash is gone, and the Service
  Call Sheet no longer blanks ordinary vocabulary ("Combination boiler") or
  ignores a shut-off's assigned room. Four duplicate warranty calculations
  collapsed into one; date-only strings no longer render a day early west of UTC.
- `5e6d932` — remaining logic. Soft-delete integrity, repair-prefill validation,
  service-sheet polish, ~8 duplicate auth round-trips per page collapsed to one
  shared request, nav menu keyboard semantics, unsaved-changes guard.
- `96b2336` — waived the `side-tab` design rule for the service call sheet only
  (that left edge encodes whether a shut-off is on file — semantic, not decor).

The exploit now fails with `ERROR: P0001: owner_user_id cannot be changed`.

### 4. SWOT weaknesses — three closed
- `80d1d87` — **Data export** (Settings → Download your data). JSON + per-section
  CSV + README. Deliberately *unredacted*, unlike the shared documents, because
  it is the owner's own data going to their own disk. The README states outright
  that uploaded files are not included — that omission is what burned Centriq's
  users. **Onboarding** — new `/welcome` flow; signup lands there. Asks for two
  things: where the water shuts off and where the electrical panel is.
- `2b4859d` — **Analytics baseline.** A private `metrics` schema (service-role
  only) computes the funnel from existing rows, retroactively. First real
  numbers: *week of 2026-06-22 — 3 signups → 1 property → 1 utility → 1
  activated (33.3%)*.
- `af6aed7` — **Reminder + payment infrastructure, built but inert.**

### 5. Reminder digest: monthly, not weekly
The user asked whether monthly would do. The evidence was already in the code:
the dashboard digest looks 14 days ahead for reminders, 30 for service, 60 for
warranties — a monthly horizon. **Monthly is now the default**, weekly optional.
The gap (created on the 5th, due on the 10th) is closed by a 35-day lookahead so
sends overlap, plus a next-day nudge for scheduled technician visits.

The digest carries **titles and dates only**. Verified against a test repair
holding a contractor name, phone, $450 cost and "gate code is 4417", plus a
Sub-Zero fridge with serial and value — none of it reached the payload.

---

## Live state of the database

**Applied migrations:** `014` (scheduled visit), `015` (security/privacy/sharing,
renumbered from the duplicate `010`), `016` (atomic account deletion), `017`
(guest read scope), `018`+`019` (function execute grants), `020` (founder
metrics), `021` (digest preferences), `022` (entitlements).

**Deployed Edge Functions:** `delete-account` (live), plus `send-digest`,
`unsubscribe`, `stripe-webhook` — all three deliberately **inert until secrets
are set**, verified live:
- `stripe-webhook` → `503 {"error":"Not configured."}`
- `unsubscribe` → `503`
- `send-digest` → `{"ok":true,"dryRun":true,…}` (runs the pipeline, sends nothing)

**Security posture:** all 33 tables have RLS with correct ownership-chain
policies; anon-executable SECURITY DEFINER functions went from 23 to **zero**;
`entitlements` has a SELECT policy and no INSERT/UPDATE/DELETE at all (proven: a
signed-in user's insert attempt yields zero rows).

---

## WHAT IS LEFT

### A. Blocked on Jesse — see `docs/NEEDS_JESSE.md`
1. **Point the domain at a host.** `ourhomefolder.com` has no A/AAAA/CNAME —
   only MX. Nothing is served. Set `NEXT_PUBLIC_SITE_URL` on the host too.
2. **One manual pass through the signed-in flows.** Every audit blocker lived in
   a signed-in flow, and the embedded test browser stalls inside Supabase's auth
   client, so these were never clicked through: demo→account import, invite →
   accept → role check (never run against the live DB), account deletion,
   building and sending a service call sheet.
3. **Delete the duplicate `/.env.local`** at the repo root (Next.js only loads
   `apps/web/.env.local`; the root copy doubles the credential surface).
4. **`brew install ripgrep`** — `pnpm security:audit` now refuses to run without
   it rather than reporting a false PASS.
5. **Ignore** the "Leaked Password Protection Disabled" advisor warning — it is
   Pro-only, which is why the toggle cannot be found.

### B. Ready to switch on — see `docs/ACTIVATION_RUNBOOK.md`
- **Reminders:** needs a Resend account (free), DNS records on
  `send.ourhomefolder.com` (SPF/DKIM/MX + DMARC on apex), a **postal address for
  the CAN-SPAM footer** (not the home address; a virtual mailbox ~$10–20/mo is
  the only unavoidable cost), then `supabase secrets set` and a `pg_cron`
  schedule. The runbook has exact commands.
- **Payments:** needs a Stripe account, two Payment Links with `product_key`
  metadata, secrets, and **Supabase Pro ($25/mo) on the day of go-live** — free
  projects pause when idle and a paused project means someone pays and gets
  nothing. Also needs **a CPA's view on state digital-goods tax**. Sell US-only
  at first to avoid EU/UK VAT entirely.

### C. Still unbuilt — real engineering work remaining
1. **The paid products themselves do not exist.** The entitlement plumbing,
   webhook, and `has_entitlement()` are done, but there is no pricing page, no
   buy button, and neither the **Handover Pack** nor the **Insurance Evidence
   Pack** is built as a purchasable artifact. The existing `/handover` page is
   the free browser-print report. This is the largest remaining piece.
2. **No marketing site.** `pages/index.tsx` is a beautiful in-app cover page, not
   a landing page — no pricing, no social proof, no screenshots, no FAQ, no email
   capture. Still an open SWOT weakness.
3. **No PWA.** Worth doing before the native app: it is installable, works
   offline, and is the *only* way to get push notifications on iOS (Safari
   requires Add to Home Screen). It is also the substrate a native build reuses.
4. **Native mobile app** — deferred by the user until the web app is ready.
   `apps/mobile` currently contains only `node_modules`.
5. **Guest-role column filtering is client-side only.** Contractor contacts,
   costs and private notes are filtered in JavaScript. Making it a database
   guarantee needs a column-filtered view or reader function (Postgres column
   privileges are per-database-role and cannot vary by per-property role). Not a
   hole today because guests cannot reach the app UI, but it should be real
   enforcement before sharing goes public.
6. **Optional analytics layer 2** — a small first-party event table for what
   leaves no row behind (drop-off inside a form, errors, pre-signup traffic).
   The SQL views cover most questions; add this only when they stop.
7. **The paywall cannot be cryptographic.** The Handover Pack is generated in the
   browser from data the user already owns, so the gate is a client-side check
   backed by an entitlements table. Normal for selling formatting; moving
   generation into an Edge Function closes it properly (~2 days) if it ever
   matters.

---

## Things worth knowing before you touch anything

- **Don't run `pnpm build` while the dev server is running** — it overwrites
  `.next` and the dev server then 500s on every route with
  `Cannot find module './chunks/vendor-chunks/…'`. Fix: stop the server,
  `rm -rf apps/web/.next`, restart.
- **The embedded browser stalls** inside Supabase's auth client on any page that
  awaits sign-in status. It is an environment quirk, not a bug — the landing
  page and signed-out pages render fine. Verify signed-in logic with unit tests,
  or ask Jesse to click it through.
- **`rg` on the PATH here is a Claude Code shim**, not real ripgrep. Scripts
  using `command -v rg` will not find it.
- **A design hook** (`impeccable`) runs after UI edits. One waiver is recorded in
  `.impeccable/config.json` for `side-tab` in the service call sheet.
- **Accessibility is a hard requirement** per `CLAUDE.md` — WCAG 2.2 AA, invoke
  the accessibility skill for user-facing UI work.
- Two pre-existing design-hook findings are deliberately unfixed: a progress-bar
  `width` transition on the dashboard, and the semantic left edge on the service
  call sheet's shut-off rows.
