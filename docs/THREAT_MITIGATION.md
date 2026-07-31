# Threat mitigation plan — answering the audit's SWOT

Written 2026-07-30, against the six threats in the pre-launch audit (2026-07-29).
Grounded in two deep-research passes (category economics / B2B2C channels, and
AI features / costs) with live 2025–2026 sources, plus the current state of the
codebase. Status labels: **CLOSED** (threat no longer applies), **NEUTRALIZED
BY BUILD** (specific work turns it off), **STRUCTURAL** (can't reach zero;
posture reduces it to a managed risk).

---

## T1 — "A funded incumbent died in this exact category" — STRUCTURAL, posture inverts it

**What actually killed Centriq** (verified): $11M raised, free consumer growth
on venture money, a pro channel that stayed too small, then a late panic-flip
of free users to $49/yr — and shutdown, with photos deleted after a short
CSV-only export window. The failure mode was **consumer CAC + a ~$50–99/yr
price ceiling**, not retention: their users were engaged enough to migrate to
two successor apps. Every survivor either bills professionals (HomeBinder:
5,000+ inspectors, 450k homeowners; RecallChek since 1988; Everplans at
~$190/mo per advisor), fronts a marketplace (Thumbtack), or stays
micro-capitalized with a B2B side (HomeZada, ~$3M raised total).

**Why the base rate doesn't transfer:** the death spiral requires venture-scale
CAC spend against consumer subscriptions. This project runs on ~$26/mo, breaks
even at two Portfolio subscribers, spends $0 on paid acquisition, and now
monetizes professionals (landlords) rather than homeowners.

**Mitigations:**
1. **Refuse the venture-consumer script permanently.** The homeowner's own
   record stays free forever; revenue comes from landlords, transaction
   moments, and (later) pro channels. Write this into PRODUCT.md as a standing
   constraint.
2. **Weaponize Centriq's death — the archival guarantee.** Centriq's ugliest
   legacy is deleted photos; "will you disappear too?" is now a known buying
   criterion in this category's content. Build: (a) extend the account export
   to include **uploaded files**, not just CSV/JSON (today the README honestly
   admits files aren't included — close that gap); (b) a public **data
   longevity pledge** page: full export always, 90-day notice + bulk download
   guaranteed if the service ever winds down, no deletion without export.
   Cheap, and it converts the category's scar tissue into our trust asset.

## T2 — "Price ceiling ~$99–189/yr, floor aggressively free" — NEUTRALIZED BY BUILD (mostly shipped)

The ceiling is real **for homeowners**. The answer is to never fight it:

1. **Shipped:** the Portfolio tier moves the paying buyer from a consumer
   (price-capped, prevention-averse) to a business with a compliance expense
   line ($29/mo is a rounding error against a $3,872 average unit turn).
2. **Price the moment, not the subscription** (the graveyard's clearest
   lesson): one-time packs at transaction peaks — Handover Pack at sale,
   Insurance Evidence / **Claim-Ready Pack** at loss — are already plumbed
   through the entitlements system. A $49–99 one-time purchase at an emotional
   peak rides an existing budget; $8/mo forever fights human nature.
3. **Free-floor judo:** make the free floor work for us by giving away what
   incumbents charge for — recall monitoring (RecallChek: $10/report to
   inspectors, $29.95 to consumers; the underlying CPSC API is free and
   public, verified live). "They charge $29.95 for this. Free, forever."

## T3 — "Value inversion: people pay after the loss" — NEUTRALIZED BY BUILD + positioning

Three converging answers:

1. **Statute beats psychology (shipped).** For landlords, the law removed the
   inversion: AB 2801 photo mandates, license-gated lead certs, registration
   renewals. Prevention is no longer optional for the paying tier.
2. **Own the moments when value peaks.** The moments are: closing (inspector/
   agent hands the record over — see T6), home sale (Handover Pack), the claim
   (Claim-Ready Pack), estate events. Build the **Claim-Ready Pack**: one
   click, insurer-formatted inventory + condition photos + maintenance log.
   The marketing numbers are the strongest in the category (United
   Policyholders, LA fires year-one survey): **69% of households underinsured,
   55% received no personal-property benefits without submitting an inventory,
   66% forced to itemize every destroyed item**. State insurance departments
   amplify exactly this message free of charge every disaster season.
3. **Don't wait for an insurer discount.** Carriers subsidize prevention
   hardware (State Farm: 1M+ free Ting sensors) because it cuts claim
   frequency; documentation *raises substantiated payouts*, so a documentation
   discount is structurally against their interest. Treat insurers as a 2–3
   year BD bet (HomeZada's NAIC-pitch path — sell retention/engagement, not
   claims), never as a launch dependency.

## T4 — "AI is table stakes; you have none by policy" — NEUTRALIZED BY BUILD, becomes a weapon

Verified economics dissolve the threat: a data-plate photo → structured-record
extraction costs **$0.0002–0.005 per scan** at current prices (Gemini
Flash-Lite / GPT-5-nano / Claude Haiku class), so documenting an entire home's
appliances costs pennies. Competitor "credit" systems imply $1–3/user/month AI
budgets; our realistic usage is cents per user *lifetime*. Credits here are
pricing theater — so the pricing page says the opposite: **"No AI credits. No
metering. Your data never trains a model."**

Build order (all compatible with the $0-default rule — every feature is inert
without a server-side key, calls are single-shot and capped, photo discarded
after extraction; a local Tesseract.js fallback toggle serves purists):

1. **Data-plate scan** (photo → brand/model/serial/year + auto-linked manual).
   Centriq's beloved signature feature, orphaned since Jan 2025; free tier
   with a ~30-scan cap. *Requires one approval: a paid vision-API key
   (docs/COST_GOVERNANCE.md gate) — at ~$3–5 per 1,000 scans.*
2. **Recall monitoring — free, unlimited.** Nightly cron over the **free,
   keyless CPSC Recall API** (verified live) matched against the asset
   registry; pair with InterNACHI's static life-expectancy chart for
   "your water heater is past expected life" flags. $0 marginal cost,
   $29.95-anchored headline.
3. **Seasonal maintenance plan** — deterministic rules table from home profile
   (systems/climate); optional single LLM personalization call (~$0.005,
   one-time). Free.
4. **Document/receipt extraction** (warranty docs, paint codes → fields).
   Free with cap; uncapped on Portfolio.
5. **"Ask your home"** (Q&A over own records + manuals) — the only genuinely
   meterable feature; Portfolio-tier only, single-shot responses, no loops.
6. Video-walkthrough inventory: **defer** (10–100× token cost, weak usage
   evidence).

## T5 — "Free tier supports ~20 homes; growth forces paid plan before revenue" — CLOSED

The audit's ceiling was the **free Supabase tier** (1 GB storage). Verified
against the live project (16 MB database, 1.6 MB documents across 4
properties): the already-mandated $25/mo Pro upgrade provides 8 GB DB + 100 GB
storage ≈ **1,000–2,000 heavily documented homes**, with overage at
~$0.001–0.002 per home per month. One Portfolio subscriber funds roughly a
thousand free homes. Revenue infrastructure now exists (subscription webhook +
packs), image compression and the 10 MB cap are live, and the breakeven sits
at **two subscribers**. Residual watch item: egress (250 GB included) —
thumbnails already mitigate; add cache headers when traffic warrants.

## T6 — "Architecture blocks B2B2C: no partner provisioning, no email pipeline, no server surface" — premise stale; remaining piece designed

Since the audit, the missing substrate shipped: **four deployed Edge Functions**
(the server surface), the **Resend pipeline** (built, inert until keys), and a
**hardened invitation system** (hashed single-use tokens, role-scoped,
append-only). What remains is one primitive plus one flow:

1. **Record transfer (the primitive).** Owner-to-owner property handoff:
   current owner (or a pro) issues a claim code; the claimant becomes owner;
   the issuer optionally retains a branded viewer seat. Reuses the invitation
   RPC pattern and the ownership-transfer logic already written for account
   deletion. This one primitive serves **three** markets: inspector→buyer
   provisioning, seller→buyer sale handover (the Handover Pack becomes a
   *live record*, not a PDF — no competitor's data model can follow), and
   estate transfer.
2. **Pro provisioning flow on top:** a `partners` table + pro dashboard page:
   inspector creates a pre-seeded property (rooms, systems, data-plate scans
   from the inspection), pays per-binder via the existing Stripe one-time
   plumbing (**$10–25/report — exactly RecallChek's proven SKU**), and hands
   the claim code to the buyer, co-branded. HomeBinder proves the
   distribution shape at 450k homeowners; agent closing-gift budgets
   ($50–300/closing) fund the agent variant with no new budget line.

*Skeptic's note carried from research:* the inspector channel is consolidating
(InspectionGo owns HomeBinder + Repair Pricer) — a standalone add-on competes
with an integrated free bundle, so entry is via report quality and the
landlord-crossover story, not price. Sequence it after the landlord tier
proves revenue.

---

## Build sequence (impact ÷ effort)

| Phase | Work | Threats hit | Effort |
|---|---|---|---|
| 1 | Full-file export + data longevity pledge; Claim-Ready Pack formatting | T1, T3 | ~2–3 days |
| 2 | CPSC recall cron + lifespan flags | T4, T2 | ~2–3 days |
| 3 | Data-plate scan Edge Function (needs key approval) + seasonal plan rules | T4 | ~1 week |
| 4 | Record-transfer primitive | T6, T3 | ~3–4 days |
| 5 | Partner provisioning + per-binder billing | T6, T1, T2 | ~1–2 weeks |
| — | Moment-based content (disaster-season, closing, UP statistics) | T3 | ongoing |

Standing constraints unchanged: $0 default config, no paid API without an
explicit key + Jesse's approval, one-shot LLM calls only, WCAG 2.2 AA, and the
homeowner's own record is never held hostage.
