# Launch checklist

Produced by the full pre-launch review, 2026-07-31. Companion to the
readiness report delivered the same day. Items are grouped by who acts and
when. Check them off in this file.

## Fixed during the review (no action — listed for the record)

- [x] Deployed Stripe webhook was stale (predated subscription + pro-binder
      handling) — all Edge Functions redeployed to current source.
- [x] 25 RLS policies re-evaluated `auth.uid()` per row — migration 026
      applied + ledgered; performance advisor now clean of WARNs.
- [x] No HTTP security headers → HSTS, nosniff, X-Frame-Options DENY,
      Referrer-Policy, Permissions-Policy on every route.
- [x] Hashed assets revalidated on every visit → `public/_headers` gives
      `/_next/static/*` a 1-year immutable cache.
- [x] Unbranded default 404 → branded `pages/404.tsx`.
- [x] `/data-promise` and `/pro` missing from sitemap → added.
- [x] Internal design-note meta tag exposed in every page head → removed.
- [x] **Landing-page promise broken:** "Try it in this browser" dead-ended
      signed-out visitors at welcome step 1 → demo fallback added.
- [x] **Claim funnel broken at sign-up:** `?next=` dropped, transfer
      recipients lost their claim code → sign-up now honours `next` with the
      same open-redirect guard as sign-in.
- [x] Stale "sharing is a future feature" copy on dashboard + handover;
      dead legacy component set in packages/ui; 4 orphaned lib modules;
      ~15 unused exports; unused deps (zod/react-hook-form/@hookform/
      resolvers/vitest-axe); dead CSS; legacy /auth placeholder;
      empty-state jump-menu anchors; assorted link/copy nits.

### Navigation and editability (founder review, same day)

- [x] Smart home promoted to its own top-level tab with a jump menu;
      Portfolio moved after Documents; mobile still exactly 5 tabs.
- [x] **Smart home could not add a room mid-form.** Fixed across all three
      device forms — and the underlying picker only ever offered *outdoor*
      spots, so no form anywhere could create an indoor room. The shared
      picker (`components/RoomLocationSelect.tsx`) now offers existing
      rooms, 15 indoor presets, 13 outdoor presets, and a "Name a new
      room…" free-text option, creating the room on save and rolling it
      back if the save fails.
- [x] **Records that were frozen after creation are now editable.** An
      audit found two classes of record: ones with a create form *plus* an
      inline editor (utilities, receipts, tenancies, compliance) were fine;
      ones built as "create form on the list page, read-only detail page
      with a status dropdown" could never be corrected — every field and
      every relationship permanent. Fixed for: repairs, issues, service
      records, reminders, rooms, condition reports, property identity.
- [x] **Linking after the fact.** Documents can now be re-linked; existing
      documents/receipts can be attached to a record (previously every
      relationship had to be born at upload time); compliance certificates
      and tenancy documents are linkable at all for the first time — the
      compliance page had been instructing users to do something impossible.
- [x] Property nickname/type were permanent for the life of the account —
      now editable, along with nine profile columns the schema defined but
      no form ever wrote (two of which the seasonal plan reads).
- [x] Device `firmware_version` accepted input and silently discarded it.
- [x] Asset `serial_number` was create-only — the field CPSC recall
      matching keys on, so a typo silently broke safety alerts.
- [x] Member management existed only as a promise in copy ("the new owner
      can remove it any time") — no page listed members or changed roles.

## Jesse — required before announcing (each ≤5 minutes)

- [x] **Cloudflare: turn on "Always Use HTTPS"** — verified done 2026-08-03:
      plain http:// now 301s to https://, HSTS header present. (Was the one
      remaining HIGH item.)
- [ ] **Verify Supabase auth URLs** (Authentication → URL Configuration):
      Site URL `https://ourhomefolder.com`, redirects
      `https://ourhomefolder.com/**`. (Sign-in worked in your QA pass, so
      this is likely done — confirm the redirect list too, it covers
      password-reset emails.)
- [ ] **Hand-test the two flows with zero live usage**: ownership transfer
      (mint on /sharing → claim on /claim with a second account) and the pro
      flow (/pro registration → co-branded claim). The tables show 0 rows
      ever — everything else in the app has been human-verified; these two
      have not.
- [ ] Optional: Cloudflare redirect rule `www → apex` (canonical tags
      already point at the apex, so this is tidiness, not SEO rescue).

## Jesse — money switches (when you decide to charge)

- [ ] Stripe account → three Payment Links (runbook §B): Portfolio $29/mo
      (`portfolio_plan`), packs $49 one-time, pro binder $9.99 one-time
      (`pro_binder`) — plus the **new $4.99/mo per-additional-home price**
      from the 2026-07-31 fee ladder (needs a Stripe product *and* an
      entitlement product key + gating code; see PRICING_AND_PLANS.md
      "Enforcement lag" note — the code still allows 2 free homes on
      purpose until this exists).
- [ ] Env vars on the Worker build: `NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK`,
      `NEXT_PUBLIC_STRIPE_PRO_BINDER_PAYMENT_LINK`.
- [ ] **Supabase Pro ($25/mo) the same day** — free projects pause when
      idle; a paused project takes money and delivers nothing.
- [ ] CPA's view on state digital-goods tax before the first dollar.
- [ ] Run the webhook tests in runbook §B (replay, unmatched, bad
      signature, browser insert) + the subscription lifecycle tests.

## Jesse — feature switches (independent of money)

- [ ] Reminder emails: Resend account + send.ourhomefolder.com DNS +
      postal address + secrets + hourly cron (runbook §A). Should precede
      any paid tier — it is the retention engine.
- [ ] Data-plate scanner: `supabase secrets set ANTHROPIC_API_KEY=…`
      (runbook §D). ~$3–5 per 1,000 scans, capped server-side.

## Engineering — post-launch (tracked, not blocking)

- [ ] CSP rollout: report-only header first, enforce after a quiet week
      (deliberately excluded from the launch header set — a wrong CSP
      breaks silently).
- [ ] Reserved-but-unwritten DB tables (`systems`, `audit_events`, 5
      automation event tables, `entitlement_downloads`): comment as
      reserved in a housekeeping migration, or drop.
- [ ] Guest-role column filtering (`repairs` contractor contacts/costs) —
      client-side only today; needs a column-filtered view before sharing
      is marketed hard.
- [ ] $4.99/home entitlement enforcement once the Stripe product exists
      (tighten `FREE_PROPERTY_ALLOWANCE`, add the per-home product key).
- [ ] Per-unit Portfolio pricing when real 20+ door portfolios appear.
- [ ] Marketing: submit the sitemap in Google Search Console; moment-based
      content (disaster season, closing season) per THREAT_MITIGATION.

## Launch-day smoke script (5 minutes, any browser)

1. https://ourhomefolder.com loads, styled, no console errors.
2. http:// (no s) redirects to https (after the Cloudflare toggle).
3. Sign in → dashboard shows your record.
4. /junk-path → branded 404.
5. Sign out → landing → "Try it in this browser" → name a home → reach the
   water-shutoff step without signing in.
6. curl -sI https://ourhomefolder.com | grep -i strict-transport (header present).
