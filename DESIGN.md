# Our Home Folder — Design system

*"The Register of Record."* The home documented like a land deed / certificate
of record: an official, warm, engraved instrument a family keeps for generations
and can hand to a bearer. It refuses both the SaaS card-dashboard and the
cream-paper-serif "heirloom" look that tools default to on a home/family
subject. Whatever changes, the product reads as a **record**, not a dashboard.

This file records the world *as built*. Product truth lives in
[PRODUCT.md](PRODUCT.md); this is the visual layer. The single source of truth
for values is `apps/web/styles/globals.css` — the contract sits at its top.

## Mechanism

- **Ground:** deep archive green on chrome/hero (`--color-green-deep #16302A`);
  warm laid **document stock** on reading surfaces (`--color-paper #ECE7DA`) —
  deliberately *not* cream parchment.
- **Accent:** gilt/brass, deployed as engraved hairlines, double frames, and
  struck marks — never as a fill-everything brand color.
- **Signatures:** a registry line (`◉ REGISTER OF RECORD`), a gilt margin rule
  down every card, folio references on entries, **struck status seals** in place
  of badges/pills, and a mono **machine-readable zone** for hard facts.
- **Status is a seal, never a streak.** No gamification, confetti, or urgency
  theatre (see PRODUCT.md anti-references).

## Tokens (`apps/web/styles/globals.css`)

All text pairs were tool-verified to **WCAG 2.2 AA (≥4.5:1)** — the ratio is
binding, the hex is replaceable.

| Role | Token | Value |
|---|---|---|
| Chrome / hero ground | `--color-green-deep` / `--color-espresso` | `#16302A` |
| Reading ground | `--color-paper` / `--surface-page` | `#ECE7DA` |
| Card | `--surface-card` | `#F4EFE3` |
| Ink | `--color-ink` / `--text-primary` | `#211C15` |
| Muted | `--color-greige` / `--text-muted` | `#6A5E4D` |
| Gilt (text/link on paper) | `--color-brass-deep` | `#855A18` (4.9:1) |
| Gilt engraving | `--color-brass` | `#C8923F` |
| Gilt highlight (on green) | `--color-brass-pale` | `#E3C288` |
| Status · good | `--status-good` / `--color-sage` | `#54663D` |
| Status · attention | `--status-attention` | `#855A18` |
| Status · urgent (oxblood) | `--status-urgent` / `--color-oxblood` | `#8A2E27` |
| Inverse | `--text-inverse` | `#F4EEDD` |

Radii are tight (`--radius-card:3px`, `--radius-control:2px`) — a printed
instrument, not a soft app. Shadows are near-flat.

## Type (`apps/web/lib/fonts.ts`, self-hosted via `next/font`)

- **`--font-title` · Cinzel** — inscriptional Roman capitals. The struck title
  face. **Apply only in uppercase contexts** (its lowercase is not a reading
  face and falls back to a serif). Used by: the wordmark, `PageHeader` titles,
  the index frontispiece title, and schedule-of-contents rows.
- **`--font-display` / `--font-body` · Spectral** — a document-grade
  transitional serif; all mixed-case titles, section headings, names, numbers,
  and running copy. Lowercase-safe, so nothing silently falls back.
- **`--font-mono` · Overpass Mono** — signage/forms mono (Highway-Gothic
  lineage). Labels, folio numbers, the registry line, and the MRZ. Reads
  *official*, not editorial or "coder".

The self-hosting is a hard constraint (performance + privacy); typefaces are
open to change, the CDN is not.

## Signature classes

- `.hb-registry` — the registry reference line; gilt mono caps prefixed `◉`.
- `.hb-cover` — engraved double gilt frame for frontispiece/deed moments.
- `.hb-card::before` — the gilt registrar's margin rule down every card.
- `.hb-seal` (+ `-good` / `-attention` / `-urgent`) — struck status stamp:
  ruled border, inset highlight, tone-colored mono caps. `UtilityBadge` renders
  these; the `brassPale` variant is a solid gilt seal for the green ground.
- `.hb-folio` — a folio/page reference on an entry.
- `.hb-mrz` (+ `-paper`) — the machine-readable zone; a dark inset mono strip
  for serials, dates, and references (`overflow-x:auto`).
- `.hb-toc-row` — schedule-of-contents rows with dotted gilt leaders + folios.

## How it propagates

The identity lives in `globals.css` tokens/classes plus the shared
`@home-folder/ui` components (`Card`, `PageHeader`, `UtilityBadge`, `Button`,
inputs) and the `Layout` chrome. Retuning tokens flows to every one of the ~40
pages, most of which style through the same variables. No new styling system was
introduced — plain CSS custom properties only (no Tailwind, no CSS-in-JS).

## Guardrails held

- **Accessibility:** WCAG 2.2 AA verified for every text pair; native checked
  controls use `accent-color:var(--color-green-deep)`; focus indicators ≥3:1.
- **Read-under-stress surfaces** (`emergency`, `handover`) keep clarity over
  character — struck titles + Spectral body, no ornament that impedes scanning.
- **Print** (`handover`, inventory) drops chrome, grain, and shadows.

---

*Direction chosen 2026-07-26 (grounded direction #5 of 7, security-print/deed;
seed key 26758523). Finish review and this record were done in-thread because
the Impeccable shipped `impeccable-finish-reviewer` / `impeccable-documenter`
subagents were not registered in this session.*
