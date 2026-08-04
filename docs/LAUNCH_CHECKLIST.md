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
- [ ] **Turn on "Confirm email"** (Authentication → Sign In / Providers →
      Email). It is currently **OFF in production**, which means no address
      in `auth.users` has ever been proven and anyone can sign up as
      someone else's email. This is the highest-value open item on the
      whole list. Migration 035 already stops an unverified address
      claiming someone else's Stripe purchase (`resolve_user_id_by_
      verified_email` requires `email_confirmed_at`) — turning this on is
      what restores that path to usefulness instead of dumping every
      purchase into `unmatched_purchases`. Full table in docs/SECURITY.md.
- [ ] **Leaked password protection ON** — the advisor still reports it
      disabled. It was Pro-only, and the project is on Pro as of
      2026-08-03, so the blocker is gone. Safe: it blocks signup and
      password *changes* only; sign-in is explicitly non-blocking, so it
      cannot lock out an existing user.
- [ ] **Secure password change ON**, password requirements = letters +
      digits / min 8, and enable **TOTP MFA** (opt-in per user).
      Do **not** enable CAPTCHA without a matching CSP change — the CSP is
      now enforcing and would block the Turnstile script.
- [ ] **Verify Supabase auth URLs** (Authentication → URL Configuration):
      Site URL `https://ourhomefolder.com`, redirects
      `https://ourhomefolder.com/**`. (Sign-in worked in your QA pass, so
      this is likely done — confirm the redirect list too, it covers
      password-reset emails.)
- [x] **Hand-test the two flows with zero live usage** — verified working
      by Jesse 2026-08-03: /pro registration → transfer minted on /sharing →
      claimed on /claim by a second account with "Prepared by {business}"
      co-branding, ownership moved, kept-role honored. The first run
      surfaced and fixed three real gaps the same day: signed-out invite
      links dead-ended (accept-invite), transfer recipients had no path to
      /claim (links added to welcome + empty dashboard), and the Transfer
      ownership card was misaligned with no copy-link button.
- [ ] Optional: Cloudflare redirect rule `www → apex` (canonical tags
      already point at the apex, so this is tidiness, not SEO rescue).

## Jesse — money switches (when you decide to charge)

- [x] Stripe catalog + Payment Links — **DONE 2026-08-03** via the Zapier
      Stripe connection (live mode; account verified fully activated:
      charges + payouts enabled, no requirements outstanding):
      - Portfolio $29/mo → buy.stripe.com/7sY28s9L2dFM0G331b6Zy00
        (product_key=portfolio_plan, pre-existing)
      - Additional Home $4.99/mo → buy.stripe.com/4gMeVee1i59gbkH1X76Zy01
        (product_key=additional_home, created)
      - Pro Binder $9.99 one-time → buy.stripe.com/5kQcN62iAfNUewTdFP6Zy02
        (product_key=pro_binder, created)
      All links carry product_key metadata (link + subscription/payment
      intent), billing address collection, and post-purchase redirects into
      the app. $49 packs deliberately skipped (no env var references them).
      Entitlement gating code for additional_home still to write.
- [x] Env vars — **DONE 2026-08-03**: all three payment-link URLs committed
      in `apps/web/.env.production` (public values, inlined at build).
      Checkout buttons live on /pricing, /pro, and the Settings Plan card.
- [x] **Supabase Pro** — verified active 2026-08-03 (org plan reads
      "pro" via the management API). The digest cron can be relied on.
- [ ] CPA's view on state digital-goods tax before the first dollar.
      **This is the last money item still open.** Sell US-only until it is
      answered; that avoids EU/UK VAT entirely (no de-minimis threshold for
      digital goods).
- [x] Webhook registered (Jesse, dashboard, 2026-08-03), secrets set
      (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SIGNING_SECRET), stripe-webhook
      redeployed with additional_home in SUBSCRIPTION_PRODUCT_KEYS.
- [x] Webhook tests — **ALL GREEN 2026-08-03**, run as signed synthetic
      events against the DEPLOYED endpoint: forged signature → 400, zero
      DB writes; valid event/unknown buyer → unmatched_purchases row;
      exact replay → deduplicated (payment_events unique constraint);
      browser-session entitlement insert → permission denied. Test rows
      cleaned. Still to watch: unmatched_purchases in the first weeks;
      subscription lifecycle (invoice.paid roll-forward) will prove out
      on the first real renewal.
- [x] Fee-ladder gating code for additional_home — **DONE 2026-08-04**
      (migration 035). Enforced in Postgres by a BEFORE INSERT trigger on
      `properties`, not just in JavaScript: free = 2 top-level homes, +1 per
      active `additional_home` subscription, unlimited on `portfolio_plan`,
      with grandfathering for accounts already over the line. Units under a
      building do not consume allowance. Verified live: a 3rd home is
      blocked, the add-on grants exactly one more, and an existing 3-home
      free account was left untouched. Also fixed the bug where
      `additional_home` unlocked *everything* — the webhook never stamped
      `property_id` and `has_entitlement` treated null as covering every
      home, so one $4.99 purchase would have covered a whole portfolio.

## Jesse — feature switches (independent of money)

- [x] Reminder emails — **LIVE 2026-08-03** (runbook §A executed end to
      end): Resend account (contact@ourhomefolder.com), domain
      send.ourhomefolder.com verified (DKIM/SPF/MX resolving); all six
      secrets set (RESEND_API_KEY, UNSUBSCRIBE_SECRET, DIGEST_CRON_SECRET,
      SITE_URL, DIGEST_FROM, POSTAL_ADDRESS = the PO box); send-digest +
      unsubscribe deployed ACTIVE; hourly `home-folder-digest` cron +
      monthly `purge-cron-history` scheduled via vault secret. Smoke
      tests: manual invoke returned ok/dryRun:false/considered:0 (correct
      off-hour), wrong secret → 401. First real sends: next local 8am for
      any user with something due. Apex DMARC record added by Jesse and
      verified resolving 2026-08-03 (p=none; tighten to quarantine after a
      month of reports). Nothing remains on this item.
- [ ] Data-plate scanner: `supabase secrets set ANTHROPIC_API_KEY=…`
      (runbook §D). ~$3–5 per 1,000 scans, capped server-side.

## Engineering — post-launch (tracked, not blocking)

- [x] CSP rollout — **ENFORCING as of 2026-08-04.** Went report-only first,
      then enforcing. `script-src` still carries `'unsafe-inline'` and that
      is now a Cloudflare decision, not a code one: the only executable
      inline script in any response is Cloudflare's own
      `window.__CF$cv$params`, whose per-request ray id makes it unhashable,
      and these pages are statically prerendered so there is no server
      render in which to mint a nonce. `pnpm --filter @home-folder/web
      verify:csp` proves app code adds zero inline scripts. Dropping
      `'unsafe-inline'` is one zone toggle away — see "Jesse — Cloudflare"
      below and docs/SECURITY.md.
- [x] Reserved-but-unwritten DB tables — **DONE 2026-08-04** (migration
      037). Seven of them (`systems`, `entitlement_downloads`, and five
      automation history/link tables) are now commented as RESERVED, with
      the reason and the date. Commented rather than dropped: each belongs
      to a planned feature, and dropping one is a roadmap call. Note
      `audit_events` came off this list — 035 writes it.
      **Follow-up worth doing:** `entitlement_downloads` is the dispute
      evidence Stripe asks for on digital goods, and it cannot be
      reconstructed after the fact. Wire it before the first chargeback.
- [x] Guest-role column filtering — **DB-enforced 2026-08-03** (migration
      031): table-level SELECT on repairs revoked and re-granted column-by-
      column excluding contractor contacts/costs; full-household roles
      (owner/co_owner/editor/viewer) read them via the SECURITY DEFINER
      `get_repairs_private_fields` RPC, merged back in lib/repairs. Verified
      by impersonation: direct column select → permission denied; stranger
      RPC → 0 rows; owner RPC → fields returned. (Found and fixed the
      Postgres gotcha that column REVOKE is a no-op under a table-level
      grant.)
- [x] $4.99/home entitlement enforcement — **DONE 2026-08-04**, same
      migration 035 as the fee-ladder item above.
- [ ] Per-unit Portfolio pricing when real 20+ door portfolios appear.
- [x] Wire `entitlement_downloads` — **DONE 2026-08-04** (migration 038).
- [x] Digest send could silently drop a whole period — **FIXED 2026-08-04**
      (migration 039 + send-digest v11). Everyone monthly was due in the
      same local hour on the 1st, the loop had no delay, and a failed send
      wrote a `digest_log` row the due-check read as proof of delivery.
      From the third subscriber in a timezone onward, people would have
      stopped receiving digests with no trace anywhere anyone looks. Now:
      only `sent`/`skipped` suppresses, monthly retries on days 1-3 and
      weekly Mon-Tue, 600ms pacing, 80/run ceiling spilling to the next day,
      and `digest_log` writes are upserts (it is UNIQUE on
      user_id+kind+period_key, so the naive retry would have double-mailed).
- [ ] **Resend free tier is 100 emails/day.** Not close yet — one subscriber,
      first send 1 September — but every monthly reader lands on the same
      day, so the ceiling is ~100 *subscribers*, not 100/day of steady
      traffic. Watch `digest_log` for `status='failed'` as signups grow.
- [ ] Audit trail records successful sensitive actions but **not blocked
      escalation attempts** — the guard triggers `raise`, which rolls back
      any audit row written in the same transaction. Closing this needs an
      out-of-transaction write path (dblink self-connection or a queue), so
      it is real work, not a one-liner.
- [ ] Marketing: submit the sitemap in Google Search Console; moment-based
      content (disaster season, closing season) per THREAT_MITIGATION.

## Fixed 2026-08-04 (post-launch, found by founder QA)

- [x] **Sign-in wrote no profile.** `ensureProfileForUser` upserted `email`,
      whose UPDATE grant 033 revoked. PostgREST compiles `.upsert()` into
      `ON CONFLICT (id) DO UPDATE SET id = excluded.id, …`, so the conflict
      target lands in the SET list too — **no upsert can work on `profiles`**.
      Now UPDATE-then-INSERT.
- [x] **An unresolved session read as "signed out".** supabase-js resolves the
      token per request and falls back to the publishable key when
      `getSession()` is null, so reads during a sign-out→sign-in switch ran as
      `anon` — which 031/033 had revoked, turning a quiet empty result into
      `permission denied for table utilities` shown to the user. Reads now go
      through `guardedRead` (re-check session, retry once, never leak the
      Postgres text); demo-storage branches confirm signed-out state uncached
      before writing a home to the browser instead of the account.
- [x] **Demo import was unusable for the people it exists for.** It required
      an existing property; a fresh signup has none. Now creates the home from
      the demo copy, and `/welcome` opens on import-or-discard rather than
      dropping them into a wizard that ignores their work.
- [x] **Audit tooling:** `grantaudit.py` resolves every select-list constant
      and diffs it against the live grant model — 54 sites, 7 restricted
      tables, zero mismatches. **Re-run after any column-grant migration.**
      The original 033 verification used impersonated transactions at the data
      layer, which structurally cannot catch a client sending the wrong column
      list or statement shape.

## Launch-day smoke script (5 minutes, any browser)

1. https://ourhomefolder.com loads, styled, no console errors.
2. http:// (no s) redirects to https (after the Cloudflare toggle).
3. Sign in → dashboard shows your record.
4. /junk-path → branded 404.
5. Sign out → landing → "Try it in this browser" → name a home → reach the
   water-shutoff step without signing in.
6. curl -sI https://ourhomefolder.com | grep -i strict-transport (header present).
