# Reading guide — understand this build from beginning to end

For anyone joining the project. Read in this order; each document says why
things are the way they are, not just what they are.

## 1. What we're building and for whom
- [../PRODUCT.md](../PRODUCT.md) — positioning, voice, design constraints.
- [PRD.md](PRD.md) — the original product requirements.
- [USER_JOURNEYS.md](USER_JOURNEYS.md) — **every persona's path through the
  app**, from first visit to the moments that matter (sale, claim, deposit
  dispute). Start here if you want to understand the product in 15 minutes.

## 2. Why it's built this way
- [DECISIONS.md](DECISIONS.md) — **the decision log.** Numbered, dated
  decisions with the reasoning and the consequences we accepted. If you're
  about to ask "why didn't they just…", the answer is probably here.
- [ARCHITECTURE.md](ARCHITECTURE.md) — monorepo layout, runtime model, schema
  overview (early-phase snapshot; schema truth lives in supabase/migrations/).
- [SECURITY.md](SECURITY.md) + the four security playbooks
  (AUTHORIZATION_IDOR / ENDPOINT_AUTH / FORM_VALIDATION / SECRETS_ENV) — the
  enforcement model. The one-sentence version: **the browser talks straight
  to Postgres, so RLS is the only boundary that counts.**
- [COST_GOVERNANCE.md](COST_GOVERNANCE.md) — the standing $0-default rule and
  the approval gate for anything paid.

## 3. What it costs and how it makes money
- [PRICING_AND_PLANS.md](PRICING_AND_PLANS.md) — **every plan, every price,
  and the evidence behind them**: unit economics, breakeven, and why the
  homeowner's own record is free forever.
- [PORTFOLIO.md](PORTFOLIO.md) — the landlord/multi-unit tier: market
  research, the units-are-properties model, monetization.
- [ACTIVATION_RUNBOOK.md](ACTIVATION_RUNBOOK.md) — the exact switch-on
  sequence for reminder emails and payments (both built, both inert until
  accounts/keys exist).

## 4. Where it's going
- [THREAT_MITIGATION.md](THREAT_MITIGATION.md) — the six SWOT threats from
  the pre-launch audit and the researched countermeasures, with the phased
  build sequence we are executing.
- [NEEDS_JESSE.md](NEEDS_JESSE.md) — everything blocked on the founder.
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md) — running engineering handoff.

## 5. Operations
- Migrations: **never `supabase db push`** — see the workflow in
  SESSION_HANDOFF.md ("Migration workflow — important").
- [SUPABASE_BACKUP_AND_USAGE_CHECKLIST.md](SUPABASE_BACKUP_AND_USAGE_CHECKLIST.md),
  [ROLLBACK_PLAN.md](ROLLBACK_PLAN.md), [MANUAL_QA_CHECKLIST.md](MANUAL_QA_CHECKLIST.md),
  [GITHUB_RELEASE_PROCESS.md](GITHUB_RELEASE_PROCESS.md).
- [accessibility/](accessibility/) — the WCAG 2.2 AA standard enforced at
  build time.
