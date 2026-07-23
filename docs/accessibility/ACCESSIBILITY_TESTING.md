# Accessibility Testing Strategy

Four layers. **No single layer is sufficient** — automated tools catch roughly a
third of WCAG issues, so manual testing is mandatory. **Never describe
accessibility as "verified" when the required manual testing hasn't been done,
and never treat a Lighthouse score or zero axe violations as proof.**

Before adding tools: **inspect the project's stack and existing tooling first.**
Prefer what's already installed; choose maintained packages; don't install
abandoned ones; never add a paid/recurring-cost service without Jesse's explicit,
up-front approval.

---

## Layer 1 — Static & development-time checks

Catch issues as code is written.

**React / web:**
- **eslint-plugin-jsx-a11y** — lint JSX for missing alt, label/control
  associations, invalid ARIA, redundant roles, etc. (Next.js's ESLint config
  includes it; enable it in Vite/React projects.)
- **axe-core** in dev — e.g. `@axe-core/react` logs violations to the console
  during development.
- **TypeScript strict** — types catch a class of prop/state mistakes; keep
  `strict: true`.
- Framework-native lint rules where they exist.

**React Native / Expo:** ESLint RN plugins where available; rely more on device
testing (Layer 3) since static coverage is thinner.

## Layer 2 — Automated browser testing

Integrate into the **existing** browser-test framework. If **Playwright** is
present, use **@axe-core/playwright**; with Jest/Vitest + Testing Library, use
**jest-axe/vitest-axe** on rendered components. Write tests for critical routes
and major workflows, e.g.: signup, login, primary navigation, account creation,
checkout/subscription, key forms, search, dashboards, core CRUD, settings.

Automated scans check a subset of criteria (contrast, names, roles, ARIA
validity, some structure). They **cannot** confirm focus order, screen-reader
comprehension, meaningful alt text, or that a workflow is actually completable.

## Layer 3 — Manual testing (required; the core of assurance)

Perform for every accessibility-affecting change, and fully before a major
release:

- **Keyboard only** — unplug the mouse. Reach and operate everything; check tab
  order, visible focus, no traps, `Esc`/arrow behavior, skip link, focus
  restoration.
- **Focus sequence** — logical, matches visual order, moves correctly on
  dialog/route changes.
- **Screen reader** — Web: VoiceOver+Safari (macOS), NVDA (Windows) where
  available; iOS: VoiceOver; Android: TalkBack. Confirm names/roles/states,
  reading order, announcements, and that the **core workflow completes**.
- **Zoom / reflow** — 200% text and 400% zoom / 320px width: no clipping, no
  2-D scroll for single-column content.
- **Text resizing / OS scaling** — browser text-only zoom; iOS Dynamic Type;
  Android font scale.
- **Reduced motion** — enable the OS setting; confirm non-essential motion is
  reduced.
- **Error handling** — trigger validation; errors announced and associated.
- **Modal behavior** — focus in/trap/restore, `Esc`, background inert.
- **Responsive states** — mobile/tablet/desktop; touch targets.
- **Mobile screen readers & touch** — swipe navigation, target size, gesture
  alternatives on real devices.

The **U.S. Access Board ICT Testing Baseline** (`SOURCES.md`) is a good
standardized manual procedure.

## Layer 4 — User testing

For major public products, recommend **periodic testing with people who use
assistive technology** (screen readers, switch access, voice control,
magnification) when practical. Real AT users surface issues no checklist does.
Budget/scope with Jesse; document findings in `audits/`.

---

## Selecting the testing stack (per project)

1. Detect the stack and current tooling (see
   `~/.claude/skills/accessibility/scripts/check-a11y-tooling.sh`, or inspect
   `package.json`).
2. Map to layers:
   - **Next.js** → jsx-a11y (built into its ESLint) + axe in dev + Playwright/
     @axe-core if E2E exists + manual.
   - **Vite + React** → add eslint-plugin-jsx-a11y + @axe-core/react (dev) +
     jest-axe/vitest-axe or Playwright if present + manual.
   - **Expo / React Native** → RN lint where available + **device** VoiceOver/
     TalkBack testing (Layer 3 carries the load) + manual.
3. Add only maintained packages; reuse existing test runners; record the chosen
   stack in the project's `docs/accessibility/` (or a short note in
   `ACCESSIBILITY_TESTING.md` copy).

## CI/CD

- Inspect existing CI before changing it; **don't weaken it**.
- Where appropriate, add an accessibility gate reusing installed tooling: ESLint
  jsx-a11y in the lint job, and axe assertions in the existing E2E/unit job.
- If a platform has **no** automated a11y path (e.g., native mobile screen-reader
  behavior), **document the manual release requirement** instead of pretending
  CI covers it.
- No new paid/recurring service without explicit approval. No accessibility
  overlay.

## What "passing" means

A change passes accessibility testing when: Layer 1 + Layer 2 are green **and**
the relevant Layer 3 manual checks were actually performed and pass, with results
recorded. Report any manual check **not yet done** as an open risk — do not imply
coverage that didn't happen. See `ACCESSIBILITY_RELEASE_CHECKLIST.md` for the
severity gates.
