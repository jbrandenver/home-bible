# The Portfolio tier — landlords, buildings, units

Added 2026-07-30 (migration `023_portfolio_foundation.sql`, branch
`feat/portfolio-enterprise`). This is the enterprise/landlord layer: multiple
properties, apartment buildings with units, roll-up views, and the three
landlord record types the market research says people will actually pay for.

## Why this exists (the research, compressed)

Market research (July 2026, sources in the session artifacts) found a real
structural hole:

- **All-in-one landlord platforms** (Stessa, TurboTenant, RentRedi, Hemlane,
  Buildium, DoorLoop) are accounting/rent-first; documentation is a bolted-on
  checkbox. TurboTenant now gives basic condition reports away **free**.
- **Inspection specialists** (RentCheck at $1.25/unit/mo, zInspector, HappyCo)
  sell inspection *events*, not a living record — and HappyCo absorbed
  zInspector upmarket, orphaning small operators.
- **Nobody** sells the permanent, structured, unit-level record of the
  physical asset — appliances/serials/warranties, systems, paint, compliance
  certificates, condition history — to 1–50-unit operators. That is exactly
  what this app already is for one home.

Two hard lessons bound the strategy:

1. **Pure documentation does not command money.** Centriq died at $49/yr.
   What commands money is statutory output with deadlines and fines attached.
2. **The anchor is California AB 2801** (effective 2025): landlords must take
   timestamped photos before tenancy, at move-out before repairs, and after
   repairs, and deliver them with the itemized deduction statement. Plus city
   regimes: NYC Local Law 31 (lead, 10-year retention), Seattle RRIO
   (2-year registration), Philadelphia (lead cert gates the rental license),
   MA smoke certs at transfer. In these places documentation is something a
   city can demand and fine against.

Pricing norms for the segment: 1–10 units pay $0–15/mo total; 10–50 units pay
$50–200/mo. A documentation product with compliance value can plausibly charge
**~$29–49/mo for ~10 doors, ~$2–3/unit beyond**. The consumer tier stays the
top-of-funnel: the same house record graduating from "my home" to "my 30
doors" is a story no competitor's data model can follow.

## The data model decision: units ARE properties

An apartment unit needs everything a house already has — rooms, assets with
serials, documents, repairs, sharing, handover. So a unit is a `properties`
row with `parent_property_id` pointing at its building and a `unit_label`.
Nothing re-parents; every existing table, RLS policy, guard trigger, page and
report works per-unit unchanged.

Constraints (enforced by `guard_property_unit_nesting`, BEFORE INSERT OR
UPDATE, because the properties UPDATE policy admits editors):

- one level only (building → unit, never unit → unit);
- a unit shares its building's `household_id` and `owner_user_id`;
- a building with units cannot itself become a unit.

`households` is the portfolio: it already groups every property a user owns
(one active household per user, enforced by a unique index since 015). No new
grouping table was needed.

The app resolves the working property via the **active-property selection**
(`localStorage`, `getActivePropertyId` in `apps/web/lib/properties.ts`) with a
fallback that prefers buildings/homes over units — so a bulk unit import can
never silently become someone's whole app.

## The three landlord record types

| Table | What it is | Why it's worth money |
|---|---|---|
| `tenancies` | Who held the unit when; the deposit at stake (cents), returned date, status | Anchors deposit deadlines and the condition-report timeline |
| `condition_reports` + `condition_report_entries` | Timestamped move-in / move-out / after-repairs / periodic walkthroughs, per-room entries, photos via `documents.condition_report_id` | The AB 2801 evidence chain; assembles into the printable deposit packet. 26% of renters report withheld deposits; courts side with whoever has the signed, dated record |
| `compliance_obligations` | Registration/license/inspection/certification deadlines with authority, frequency, retention years, official reference URL | Missed renewals block rental licenses and draw fines; today's alternative is a generic reminder app. Templates seeded for NYC, Seattle, Philadelphia, CA, MA + general |

Access model for all three: **trusted members read** (owner/co_owner/editor/
viewer — deposits and tenancy details are none of a maintenance guest's
business), **editors write**, provenance guarded — the same helper stack as
015/017. Photos/certificates attach through `documents` FK columns with new
document types (`condition_photo`, `compliance_certificate`,
`tenancy_document`).

## Roll-ups

`apps/web/lib/portfolio.ts` loads assets/repairs/reminders/compliance across
every visible property (RLS filters row-by-row) and `buildPortfolioOverview`
computes: open repairs, reminders due ≤30d, warranties expiring ≤90d,
compliance due ≤60d/overdue, equipment ≥10 years old — per property and
portfolio-wide. This is the "all water heaters older than 10 years" view that
exists nowhere below enterprise facility software.

## Monetization

- Product key **`portfolio_plan`** — the first **recurring** entitlement.
  Webhook lifecycle in `supabase/functions/stripe-webhook/index.ts`:
  checkout stamps `provider_subscription_id` + `expires_at` (period end + 3
  days grace), `invoice.paid` rolls `expires_at` forward,
  `customer.subscription.deleted` revokes. Fails safe: a missed webhook means
  access lapses, never lives forever. `has_entitlement()` needed no changes.
- Free allowance: `FREE_PROPERTY_ALLOWANCE = 2` properties (home + one more).
  The plan starts at the third door or the first building.
- **Gating is soft until payments are configured** (no
  `NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK` → features ungated, upgrade
  card says "not yet available"). Never gate users behind a checkout that
  does not exist. Activation steps: docs/ACTIVATION_RUNBOOK.md §B.
- The existing one-time packs (`handover_pack`, `insurance_evidence_pack`)
  are unchanged and compose: an insurance evidence pack per unit is a natural
  portfolio upsell later.

## What this deliberately does NOT do

- **No rent collection, no accounting, no tenant screening, no vendor
  dispatch.** Crowded, capital-intensive, and off-mission. Stessa/TurboTenant
  can keep the ledger; we keep the asset record.
- **No legal advice.** Compliance templates cite official sources and say
  "verify with the jurisdiction". The deposit packet is evidence formatting,
  not a legal document generator.
- **No tenant-facing accounts** (yet). The existing share roles cover the
  near-term need; a resident-self-guided inspection flow (RentCheck's trick)
  is a plausible phase 2.

## Follow-ups worth doing next

1. **Deposit packet → statutory formatting per state** (start: CA 21-day
   itemization letter wrapper around the condition-report evidence).
2. **Tenant handover kit + in-unit QR labels** generated from the unit record
   (welcome book: shutoffs, thermostat, filters) — the demo-magic feature.
3. **Per-unit insurance evidence pack** at portfolio scale.
4. **Reminders integration**: auto-create a reminder when a compliance
   obligation's `next_due` is set (the digest already looks 35 days out).
5. **Per-unit pricing** once real portfolios show up (Stripe metered or
   quantity-based price; the entitlement schema already carries amounts).
