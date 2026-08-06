---
version: 1
slug: "apps-web-pages-features-tsx"
primary_target: "apps/web/pages/features.tsx"
related_targets: ["apps/web/pages/index.tsx"]
---

# Surface brief — features page (`/features`)

**Scope & mode:** `apps/web/pages/features.tsx` — Persuade. Related: `apps/web/pages/index.tsx` (Section III links here), `apps/web/components/PlateRow.tsx` (PlateSeal), `.hb-chapter*` rules in `apps/web/styles/globals.css`.

**Audience & job:** signed-out visitors who need the WHOLE offering graspable in one or two viewports — homeowners scanning "does it do X", smart-home keepers, landlords, professionals — with depth available on click, never forced by scroll.

**Action:** primary "Begin your record — free" → `/sign-up` (cover + attestation); secondary demo → `/welcome`; Terms cell → `/pricing`.

**Proof/content:** three tiers, all computed from the single `chapters` array (never hardcode counts): (1) the plan — an at-a-glance grid of 7 chapter cards (benefit line + clause-name keywords + "Open entries N–M") plus a dark Terms cell ("Chapters I–VI: free, complete"); (2) "Who this serves" — homeowners / landlords / inspectors, using researched segment vocabulary (2 a.m. emergency, paper trail, condition reports, issue at closing); (3) the full schedule — all clauses in `<details>` chapters, folded by default, opened by click or by `#anchor` hash (useEffect); JSON-LD SoftwareApplication `featureList`.

**Chosen direction:** lifecycle-of-a-home structure (grounded candidate #5, surface seed 62be04b2), re-tiered 2026-08-06 after market research (competitor pattern: 6–8 pillar compression + hub-and-spoke depth; wall-of-text enumeration is the category's failure mode). Anti-data-entry message ("two entries, ten minutes") leads — research found setup dread is the universal objection.

**Constraints:** clauses must describe shipped capabilities only — plate scanning stays absent until live; handover copy must not claim private-entry filtering until `loadHandoverReport` honors visibility contexts; pricing facts defer to `/pricing`. PRODUCT.md voice; WCAG 2.2 AA; anchors `#begin #keeping #wired #emergency #sharing #handover #portfolio` are load-bearing (landing links + hash-open behavior) — do not rename.

**Unresolved:** real product screenshots per pillar would strengthen trust (every strong competitor uses them) — needs a way to capture polished demo-data screenshots; revisit with Jesse.
