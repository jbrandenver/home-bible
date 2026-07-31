# Decision log

The load-bearing decisions, roughly chronological, each with the reasoning
and the consequences we accepted. Format: context → decision → why →
consequences. If you're about to ask "why didn't they just…", check here
first. Dates are when the decision was made or last reaffirmed.

---

**D-1 · Browser-to-Postgres; RLS is the only enforcement boundary** *(founding)*
No API server: the web app talks to Supabase directly with the anon key and
the user's JWT. **Why:** one moving part fewer, zero server cost, and it
forces the discipline that every rule must live in the database where it
can't be bypassed. **Consequences:** anything needing a secret becomes an
Edge Function; every table needs correct RLS from day one; client-side
validation is UX, never security (see 013's DB-level text caps); per-property
*column*-level filtering can't be database-enforced without views (known gap
on `repairs`, tracked).

**D-2 · Demo mode first, account second** *(founding, hardened 2026-07)*
The whole app runs against localStorage with no account. **Why:** the product
must prove value before asking for anything; "try it on your real house right
now" is the pitch. **Consequences:** every lib carries a demo branch; the
demo→account import had to become explicit and loss-proof after the audit
found silent data destruction (BUG-1/2); demo state must never leak into a
signed-in session (the audit's raw-RLS-error bug came from exactly that).

**D-3 · Soft delete everywhere** *(founding)*
Every table carries `deleted_at`; every SELECT policy filters on it. **Why:**
home records are irreplaceable; fat-finger deletion of a decade of history
must be recoverable. **Consequences:** every query must remember the filter;
true erasure needs the dedicated account-deletion path (migration 016).

**D-4 · Typed enums mirrored exactly: DB check constraints ↔ shared Zod ↔ UI**
*(founding)* One list per concept (`packages/shared`), the DB check
constraint is the source of truth. **Why:** drift between layers is where
silent data corruption lives. **Consequences:** adding an enum value is a
three-place change (migration + shared + UI copy), on purpose.

**D-5 · Visibility as data, not pages** *(phase 6, extended in 009/015)*
Rows carry `visibility_contexts` (family/buyer/maintenance/insurance/
personal_archive); roles map to contexts in RLS. **Why:** one record must
serve many audiences without duplicating data — this is the product's core
trick (five reports from one record). **Consequences:** the dual legacy
scalar + array model must both be honored (normalizer in `lib/visibility.ts`);
re-classification needed a provenance guard so editors can't unlock rows
they can't read (015).

**D-6 · Migration workflow: numbered files, manual ledger, never `db push`**
*(2026-07, after the audit)* Migrations are `NNN_name.sql`, applied with
`supabase db query --linked -f` wrapped in begin/commit after a
begin/rollback dry-run, then hand-recorded in `schema_migrations`. **Why:**
the CLI can't reconcile our numbering with its timestamp ledger, and a
duplicated number once hid the security migration from production for months
— the audit's headline finding. **Consequences:** slightly manual, entirely
explicit; every migration must be idempotent; docs/SUPABASE_SETUP.md §4 is
stale on this point (trust SESSION_HANDOFF.md).

**D-7 · Invitations: hashed single-use tokens, append-only, no invitee UPDATE**
*(015, 2026-07-29)* Raw token returned once; SHA-256 at rest; an issued
invitation is immutable; the invitee holds no UPDATE right. **Why:** the
original design's `accepted_by = auth.uid()` UPDATE branch was a proven
co-ownership escalation (audit DRIFT-2). **Consequences:** re-issuing means
revoke + new invite; the accept RPC re-verifies the inviter still holds
manager rights at accept time.

**D-8 · Guest roles see slices, enforced in the database** *(015/017)*
maintenance_guest loses the room archive, network credentials, trend flags;
buyer/insurance roles get exactly what the sharing page promises. **Why:**
the audit proved the promises were client-side only — a contractor could
query SSIDs and credential references. **Consequences:** role changes are
RLS changes now; contractor contact details/costs on `repairs` remain the
one client-side-only filter (needs a view; tracked).

**D-9 · Reminder emails: monthly by default, digest not drip, burglary-aware**
*(021)* Monthly digest at local 8am, 35-day lookahead, nickname only — no
address, no brands/serials, no "house is empty" signals. **Why:** seasonal
cadence fits home maintenance; Resend free tier caps at 100/day; and a list
of someone's home maintenance is a burglary reconnaissance document —
minimize what email carries. **Consequences:** weekly is opt-in; ~100 active
accounts is the Resend-paid trigger (all monthly sends fire on the 1st).

**D-10 · Payments: raw Stripe Payment Links, entitlements with no write policies**
*(022)* No checkout code; webhook writes entitlements with the service role;
the table has SELECT-own and *nothing else*. **Why:** minimum integration
surface pre-revenue, and "the security model is what is absent" — any
user-writable path to entitlements is a free-money button. **Consequences:**
buyer resolution relies on `client_reference_id` + email fallback with an
`unmatched_purchases` safety net; idempotency lives in DB constraints, not
app logic.

**D-11 · One LLM call per job, capped, never by default** *(COST_GOVERNANCE)*
Default configuration costs $0; paid APIs require both a key and an explicit
founder approval; LLM usage is single-shot with bounded tokens. **Why:**
solo-founder economics and predictable costs; also the privacy story.
**Consequences:** AI features ship inert until keys exist (same pattern as
email/payments); agentic loops are off the table.

**D-12 · Accessibility and design constraints are build-time law** *(standing)*
WCAG 2.2 AA enforced in CI; plain CSS custom properties, no Tailwind/CSS-in-JS;
self-hosted fonts; Pages Router. **Why:** accessibility is a floor not a
feature (and a procurement asset for B2B2C); the styling constraint keeps the
bundle small and the design system auditable. **Consequences:** UI agents/
contributors must learn the house idioms; a design hook reviews UI edits.

**D-13 · First-party metrics only; no trackers, no cookie banner** *(020)*
Private `metrics` schema computed from rows users already created. **Why:**
a tracker on pages showing someone's private home record is a trust
contradiction, and GA4 would force a consent banner. **Consequences:**
no client-side event granularity (an optional first-party event table is a
known possible layer 2); funnel analysis is SQL.

**D-14 · The homeowner's own record is never a subscription** *(2026-07-30)*
Free tier is the full product for one home (+1 allowance). **Why:** the
category graveyard — Centriq died flipping free users to $49/yr; every
survivor bills professionals or moments. Full evidence: THREAT_MITIGATION T1,
PRICING_AND_PLANS.md. **Consequences:** revenue must come from landlords,
packs, and pro channels; free-tier costs must stay near zero (they do:
~$0.001/home/mo at Pro-plan rates).

**D-15 · Soft gating until checkout exists** *(2026-07-30)*
Paid features are visible and usable until the Stripe link is configured;
then the gate turns on. **Why:** never block users behind a buy button that
doesn't work; pre-launch users are design partners. **Consequences:** early
landlords get the tier free until activation day; the gate must be tested
when payments switch on (ACTIVATION_RUNBOOK tests).

**D-16 · The archival guarantee: full export is a product promise** *(2026-07-30)*
Export includes everything, unredacted, files included (Phase 1 work), plus a
public data-longevity pledge. **Why:** Centriq's deleted photos are this
category's defining trauma; "will you disappear too?" is now a buying
criterion we can answer structurally. **Consequences:** export must be
maintained as tables are added (CI-adjacent checklist); the pledge is a
commitment, treat it like one.

**D-17 · No TikTok-style scraping, no rent collection, no vendor dispatch, no tenant screening** *(standing scope fences)*
**Why:** rent/accounting is a crowded capital sink (Stessa et al. do it
free); dispatch is operationally heavy (Hemlane charges $20–58/unit/mo to do
it as a service); staying documentation-first is the moat. **Consequences:**
we integrate *around* those jobs (share links for vendors, export for
accountants) rather than doing them.

**D-18 · Subscriptions fail safe** *(023 webhook design)*
Subscription entitlements carry a rolling `expires_at` (period end + 3 days);
renewal events extend it; deletion revokes. **Why:** a missed webhook must
mean access lapses, never access-forever. **Consequences:** a webhook outage
longer than the grace window can briefly cut off a paying user — acceptable,
visible, and self-healing on the next `invoice.paid`.

**D-19 · Units are properties** *(023, 2026-07-30)*
An apartment unit is a `properties` row with `parent_property_id`; nesting
capped at one level; unit shares the building's household and owner. **Why:**
every existing table, policy, guard, and page works per-unit with zero
re-parenting — the unit inherits the entire product. Full rationale:
PORTFOLIO.md. **Consequences:** "primary property" resolution had to become
explicit selection (a bulk unit import must never hijack the app); roll-ups
aggregate across property ids client-side under RLS.

**D-20 · Portfolio pricing: $29/mo flat anchor now, per-unit later** *(2026-07-30)*
**Why:** market norms (PRICING_AND_PLANS.md); one flat price is explainable
and cheap to operate with Payment Links; per-unit billing (Stripe quantity/
metered) is warranted only when real 20+ door portfolios exist.
**Consequences:** very large operators are briefly underpriced — acceptable
at this stage; revisit at real usage.

**D-21 · AI: free where it's cheap, metered only where it's genuinely unbounded, local fallback for purists** *(2026-07-30)*
Data-plate scans/doc extraction free with caps (cost: pennies); recall
monitoring free and unlimited (CPSC API is free); only open-ended chat is
paid-tier. "No AI credits" is the public stance. **Why:** verified cost
research (THREAT_MITIGATION T4) shows credits in this category are pricing
theater; privacy positioning ("your data never trains a model") compounds
D-13. **Consequences:** caps are enforced server-side (Edge Function owns
the key); the vision-API key needs a D-11 approval before Phase 3 ships.

**D-22 · The record outlives the owner: transfer is a first-class primitive** *(designed 2026-07-30, Phase 4)*
Owner-to-owner claim-code transfer (sale, inspection provisioning, estate).
**Why:** the live-record handover is the one thing no competitor's data model
can follow, and it powers three journeys with one mechanism. **Consequences:**
ownership transfer must reuse the invitation-grade security pattern (hashed
single-use codes, guard triggers); the Handover Pack gains a "transfer the
record itself" upsell.
