# Pricing and plans — what, how much, and why

Written 2026-07-30. Every price in the product, the evidence behind it, and
the unit economics. The reasoning trail: market research summarized in
PORTFOLIO.md and THREAT_MITIGATION.md; decisions cross-referenced to
DECISIONS.md.

## The pricing philosophy in three sentences

1. **The homeowner's own record is free, forever** — the category's graveyard
   (Centriq, †2025, $49/yr flip) proves consumers won't pay subscriptions for
   prevention, and the free record is our acquisition, trust, and
   switching-cost engine.
2. **Businesses pay recurring** — landlords have a compliance expense line
   and statutory deadlines; $29/mo is noise against a $3,872 average unit
   turn.
3. **Everyone else pays at a moment** — one-time packs priced at the
   emotional and financial peaks (sale, claim) where the category is actually
   bought.

## The plans

| Plan | Price | Who | What it includes | Status |
|---|---|---|---|---|
| **Free** | $0 forever | Homeowners | The entire home record: rooms, systems, assets, documents, repairs, sharing, handover report, export (incl. files), reminders, recall monitoring | Live |
| **Portfolio** | **$29/mo** (product_key `portfolio_plan`) | Landlords, 3+ doors or any building | Everything, across unlimited properties/units + roll-up dashboard, tenancies, condition reports & deposit packets, compliance calendar | Built; gated softly until Stripe exists |
| **Handover Pack** | $49 one-time (indicative $29–79) | Sellers | The polished, buyer-ready handover artifact | Plumbing built; product artifact not yet |
| **Insurance / Claim-Ready Pack** | $49 one-time (indicative) | Claimants | Adjuster-formatted inventory + condition photos + maintenance log | Plumbing built; formatting is Phase 1 |
| **Pro binder** (future, Phase 5) | $10–25 per report, pro pays | Inspectors/agents | Pre-seeded, co-branded record handed to the buyer | Designed (THREAT_MITIGATION T6) |

**Free allowance inside Free:** 2 properties (`FREE_PROPERTY_ALLOWANCE`) —
a home plus one more (rental, cabin, parent's house). The plan boundary is
the *third* door or the first building, because that's where a portfolio
starts and where roll-ups/compliance become the daily tool.

## Why these numbers

- **$29/mo Portfolio.** 2026 market norms for 1–50-unit operators: 1–10
  units pay $0–15/mo total (TurboTenant $149–199/yr, RentRedi $12/mo); 10–50
  units pay $50–200/mo. Documentation-only tools price low (RentCheck
  $1.25/unit/mo) — but we bundle the compliance calendar, deposit-evidence
  chain, and asset registry, which justifies the Hemlane-style flat anchor.
  $29 covers ~10 doors comfortably; per-unit pricing beyond (~$2–3/unit) is
  a later step once real portfolios show up (D-20).
- **$49 packs.** Anchored against: competitor pricing the sale moment at $99
  one-time; RecallChek charging consumers $29.95 for a recall report;
  closing-gift budgets of $50–300. One-time, no Stripe Billing fee.
- **$10–25 pro binder.** RecallChek has sold inspectors a $10/report add-on
  since 1988; HomeBinder distributes free-to-homeowner binders through
  5,000+ inspectors. The SKU shape is proven; we enter on report quality.
- **No AI credits, ever.** Verified per-scan vision costs are $0.0002–0.005;
  a whole home's appliances cost pennies to extract. Competitors' credit
  systems imply $1–3/user/mo AI budgets — ours is cents per user lifetime,
  so "no credits, no metering, your data never trains a model" is both true
  and a pricing-page weapon (THREAT_MITIGATION T4).

## Unit economics (verified July 2026)

**Per Portfolio subscriber at $29/mo:** Stripe 2.9% + $0.30 + 0.7% Billing =
$1.34 → **$27.66 net**. Per $49 pack (one-time, no Billing fee): $1.72 →
**$47.28 net**.

**Fixed monthly costs:**

| Stack | Total/mo | Breakeven |
|---|---|---|
| Lean (Cloudflare hosting $0, Resend free, Supabase Pro $25, domain ~$1) | ~$26–31 | **1 subscriber** |
| Lean + Resend Pro (needed at ~100 active accounts — monthly digests all fire on the 1st against a 100-email/day free cap) | ~$46–51 | **2 subscribers** |
| Vercel stack (Vercel Pro $20 — Hobby prohibits commercial use) | ~$66 | **3 subscribers** |

**Free-user economics:** Supabase Pro includes 100k MAU and 100 GB storage ≈
1,000–2,000 heavily documented homes; marginal cost beyond ≈ $0.001–0.002
per home per month. **One subscriber funds roughly a thousand free homes** —
the free tier is not a cost problem at any scale this project will see
pre-revenue.

**Breakeven with conversion assumptions** (no landlord-software conversion
data exists publicly; these are stated assumptions, not benchmarks): landlord
share of signups 5–10%, landlord→paid 15–25% → blended 0.75–2.5%. Practical
breakeven of 2 subscribers arrives at **~80–270 free users (base ~135)**.

## Standing pricing rules

- **US-only at first**; EU/UK VAT has no de-minimis threshold for digital
  goods. Going international = switch to a merchant of record (checkout
  swap, not architecture change).
- **Refund on request, immediately; never contest a dispute** — a disputed
  $29 sale nets ≈ −$44 even when won.
- **Soft gating until checkout exists** (D-15): features never sit behind a
  buy button that doesn't work. `NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK`
  unset → ungated with an honest "not yet available" card.
- **The paywall is not cryptographic** (known, documented): packs are
  generated in the browser from data the user can already read. Acceptable
  for formatting-and-convenience products; an Edge-Function generation path
  closes it properly if abuse ever appears.
- **A CPA reviews state digital-goods tax before the first dollar.**
