---
version: 1
slug: "apps-web-pages-index-tsx"
primary_target: "apps/web/pages/index.tsx"
related_targets: ["apps/web/pages/pricing.tsx","apps/web/pages/features.tsx"]
---

# Surface brief — public marketing landing (`/`)

**Scope & mode:** `apps/web/pages/index.tsx` — Persuade. Related: `apps/web/pages/pricing.tsx` (schedule of fees), `apps/web/pages/features.tsx` (Schedule A), `apps/web/components/PlateRow.tsx`.

**Audience & job:** signed-out homeowners deciding whether a slow, unglamorous habit (documenting the home) is worth starting. Signed-in users are redirected to `/dashboard`.

**Action:** primary "Begin your record — free" → `/sign-up`; secondary "Try it in this browser" → `/welcome` (demo mode, truthful: data stays on device). Visitor masthead: Features · Pricing · Sign in · Sign up.

**Proof/content:** four authored "plates" (emergency sheet, warranty entry, care history, handover) drawn in the product's own grammar — seals, folios, dotted leaders, MRZ — labeled "Entries shown are illustrative." Section III ("What the record holds") is Schedule A in brief: seven chapter rows linking to `/features` anchors, closed by "Read the full schedule — every entry." Section IV names the three keepers (homeowners, households, landlords & professionals) with links to `/features#portfolio` and `/pro`. No invented prices/customers/benchmarks.

**Chosen direction:** the page IS the register, read cover to close, with its own schedule of contents (grounded structure #3, surface seed 9846bb58; contents now run I–VI). Memorable moment: the plates — product truth rendered as leaves of the instrument.

**Constraints:** PRODUCT.md voice (calm, archival, no urgency theatre); WCAG 2.2 AA; visitor masthead hides app nav on public routes (see Layout `isPublicSurface`); the retired former register name is banned vocabulary. Section III chapter rows must stay in lockstep with the chapter anchors and titles in `features.tsx`.

**Unresolved:** none — the Portfolio fee ($29/mo) is now fixed in Stripe and stated on `/pricing`.
