---
version: 1
slug: "apps-web-pages-features-tsx"
primary_target: "apps/web/pages/features.tsx"
related_targets: ["apps/web/pages/index.tsx"]
---

# Surface brief — features page (`/features`)

**Scope & mode:** `apps/web/pages/features.tsx` — Persuade. Related: `apps/web/pages/index.tsx` (Section III links here), `apps/web/components/PlateRow.tsx` (PlateSeal).

**Audience & job:** signed-out visitors who need to know whether the app covers their case before signing up — homeowners scanning for "does it do X", smart-home keepers, landlords, and professionals. Also the landing page's proof annex: the answer to "what exactly do I get".

**Action:** primary "Begin your record — free" → `/sign-up` (cover, mid-schedule strip after the emergency chapter, attestation); secondary "Try it in this browser" → `/welcome`.

**Proof/content:** Schedule A — every shipped capability entered as a numbered clause (numbering and counts are computed from the `chapters` array, never hardcoded), grouped into 7 life-moment chapters: begin, keeping, wired, emergency, sharing, handover, portfolio. Chapter seals mark plan coverage ("Free register" / "Beyond the first home"). JSON-LD: SoftwareApplication with `featureList` derived from the same array.

**Chosen direction:** lifecycle-of-a-home structure (grounded candidate #5, surface seed 62be04b2) inside the committed Register of Record world; staging challengers declined for reading clarity. Memorable moment: reading your own future — moving day to closing table — with the capabilities filed at the moment of life they serve.

**Constraints:** clauses must describe shipped capabilities only — plate scanning (`lib/plateScan`, deployed-inert) is deliberately absent; add it as clause when the key goes live. Pricing facts defer to `/pricing` (linked, never restated beyond "free"). PRODUCT.md voice; WCAG 2.2 AA; anchors (`#begin` … `#portfolio`) are linked from the landing page and must not be renamed casually.

**Unresolved:** none.
