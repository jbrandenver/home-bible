# Our Home Folder

The complete record of the place you live.

A private archive of a home — rooms, utilities, appliances, warranties, repairs,
receipts, documents, and care history — kept in one place so that anyone can
pick up where the last person left off.

Live at `ourhomefolder.com`. Repo is a pnpm monorepo; the product is
`apps/web`.

## What it is

A structured home map is the hero: floors → rooms → utilities, appliances,
accessories, smart devices, and tools, each carrying its own warranties,
repairs, receipts, and reminders. Around that sit the workflows that make the
record worth keeping — a handover pack, an emergency overview, a reminder
digest, and a completeness score.

It is a **record**, not a dashboard. The value compounds with time and accrues
to whoever inherits it.

## Who it's for

Homeowners and the people who share a home with them — partners, family,
house-sitters, a new owner at closing, an executor. The archive is written by
one person and read by someone else, often years later and often under
pressure ("the boiler is leaking and I don't know who installed it").

Two jobs, and the second is the differentiator:

1. **Keep** — capture what you own and what's been done to it, without it
   feeling like data entry.
2. **Hand on** — make the whole thing legible to a person who wasn't there.

Design for the reader who is stressed, unfamiliar, and in a hurry. That reader
never sees onboarding.

## Voice

Calm, archival, plainspoken. The product's own words for itself: *"a calm,
complete archive of your home — kept the way a family keeps a ledger"* and
*"beautiful enough to keep, clear enough to hand on."* Existing copy runs to
"Begin your record" rather than "Get started" — keep that register.

Never: streaks, badges, congratulation, urgency theatre, exclamation marks, or
anything that implies the home is a score to maximize. A home record is
long-lived and unglamorous, and the tone should be restful enough to return to
after six months away.

## Surfaces and modes

**Persuade** — `index`, `privacy`, `terms`. The public marketing and legal
surface. Its job is to make a slow, unexciting habit feel worth starting.

**Operate** — everything behind auth: `dashboard`, `home-map`, `inventory`,
`assets`, `maintenance`, `repairs`, `issues`, `reminders`, `documents`,
`receipts`, `emergency`, `handover`, `settings`, plus the `add-*` and
`create-property` capture flows.

Two Operate surfaces are read under stress and deserve their own bar:
`emergency` (shutoffs, contacts — scanned in a panic, possibly on a phone, one
handed) and `handover` (print/PDF output read by someone with no account and
no context).

## Anti-references

- Smart-home control panels — this is not telemetry, and nothing here is
  real-time.
- Real-estate listing sites — the home is not a valuation or an asset to sell.
- Productivity SaaS chrome — sidebar-plus-cards-plus-badges generic app look.
- Gamified habit trackers — no streaks, no confetti, no completion pressure.

## Design latitude

The current look is not disliked, but it is due a refresh. Treat it as a
starting position with real equity, not as a specification to reproduce.

**Keep — this is the identity.** The archival, unhurried, printed-record
character. A home ledger you'd be content to open in ten years. Warmth over
clinical neutrality. Editorial typesetting over app chrome. Whatever changes,
the product should still feel like a *record* rather than a *dashboard*.

**Open — refresh freely.** Specific typefaces and their pairing, the exact
palette values and how the accent is deployed, spacing scale and density,
radii, elevation and shadow treatment, rule and border styling, iconography,
motion, and the composition of any individual page. If a change makes the
record feel more legible, more permanent, or more worth returning to, it is
in scope. Present a considered direction rather than asking permission for
each value.

**Two guardrails on the refresh:**

1. Don't drift toward generic productivity-SaaS styling. That is the failure
   mode to avoid — see Anti-references above.
2. Don't trade legibility for expression on `emergency` and `handover`. Those
   two are read under pressure by people with no context, and clarity outranks
   character there.

## Constraints

These are binding regardless of the refresh.

- **Accessibility.** WCAG 2.2 AA, enforced at build time — see
  `docs/accessibility/`. Any new palette must clear contrast before it ships.
  Note that `--color-brass-deep` (`#855A18`) is a darkened accent chosen
  specifically to reach 4.5:1; the *hex is replaceable, the ratio is not*.
  Whatever replaces it must be verified with a tool, not by eye.
- **Styling mechanism.** Plain CSS custom properties in
  `apps/web/styles/globals.css` — **no Tailwind, no CSS-in-JS library**. Many
  pages use inline `style` objects. Change the token values freely; don't
  introduce a new styling system to do it.
- **Font delivery.** Self-hosted via `next/font` (`apps/web/lib/fonts.ts`).
  The *typefaces* are open to change; the *self-hosting* is not — a CDN
  webfont is a regression, it was deliberately removed for performance and
  privacy.
- **Stack.** Next.js 15 (Pages Router), React 19, TypeScript.
- **Supabase** backs persistence, with RLS-enforced sharing roles. Demo mode
  falls back to `localStorage` when Supabase is unconfigured or signed out.
- **Cost governance** — see `docs/COST_GOVERNANCE.md` before adding any paid
  service or heavyweight dependency. A refresh should not add either.

## Run it

```bash
pnpm dev:web    # from the repo root — Next dev server on :3000
pnpm typecheck
pnpm test
```

---

*Design latitude reflects a direct ruling (2026-07-26): "not unhappy with it,
but it could use a refresh." Inferred from the codebase rather than stated:
the audience framing, the two-jobs split, and the anti-references. Correct
anything that's wrong — this file is the brief every Impeccable command reads,
and it will honor a clear brief over its own preferences.*
