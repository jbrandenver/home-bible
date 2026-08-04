---
name: accessibility
description: Build and verify accessible UI to WCAG 2.2 Level AA, as required by this project's accessibility standard. Use this skill for ALL user-facing UI work — creating or modifying components, pages, routes, forms, dialogs, navigation, charts, emails, or any markup, styles, or behavior a user sees — even when the task never mentions accessibility. Also use it when reviewing UI code, evaluating third-party UI components, writing UI tests, or preparing a release. If a change touches anything a user will see or interact with, this skill applies.
---

# Accessibility

Accessibility is a non-negotiable product requirement in this project, owned by
Jesse Branson. The governing policy, implementation detail, and testing
procedure live in `docs/accessibility/` — this skill is the workflow that ties
them together. Build the accessible version first; never defer accessibility to
a later pass, and never knowingly trade accessibility for visual design without
flagging the conflict and letting Jesse decide.

**Targets:** WCAG 2.2 Level AA for web; WCAG 2.2 A+AA principles plus native
Apple/Android requirements for mobile. A stricter project- or client-specific
requirement wins (see `docs/accessibility/JURISDICTION_MATRIX.md`).

## Workflow

### 1. Before writing UI code

Read the sections of `docs/accessibility/ACCESSIBILITY_ENGINEERING_GUIDE.md`
relevant to the change (it's organized by topic: semantic structure, keyboard,
forms, color, text/responsive, images, media, motion, touch, dynamic patterns,
screen readers, React/Next.js, React Native/Expo, native, third-party, AI-generated
UI). Two rules frame everything in it:

1. Prefer **semantic HTML / native platform controls** before ARIA or custom
   widgets — the most robust accessibility is the kind you don't re-implement.
2. The DOM/visual tree is **not** the accessibility tree — verify with a screen
   reader, don't assume.

If the change involves adopting third-party or embedded UI (auth, payments,
date pickers, chat widgets, CAPTCHA, etc.), evaluate its accessibility *before*
adoption — popularity or price is not evidence. Never adopt an accessibility
overlay/widget as a substitute for accessible source.

### 2. During implementation

Accessibility is addressed **while** building, not after. As you write each
piece, satisfy the guide's requirements for it (accessible names, keyboard
operability, focus management, contrast, target size, announced dynamic
changes, reduced motion, zoom/reflow). If a requirement genuinely conflicts
with a design request, flag the conflict for Jesse instead of silently
dropping the accessible behavior.

### 3. Test the change

Follow `docs/accessibility/ACCESSIBILITY_TESTING.md`. Four layers; automated
tools catch roughly a third of WCAG issues, so manual checks are mandatory:

1. **Static/lint** — eslint-plugin-jsx-a11y, axe in dev, TypeScript strict.
2. **Automated browser** — axe assertions in the existing test framework
   (@axe-core/playwright, vitest-axe/jest-axe) for affected routes.
3. **Manual** — keyboard-only pass, screen reader on the core flow, zoom/
   reflow, reduced motion, error announcement. Required for every
   accessibility-affecting change.
4. **User testing** — periodic, with real AT users, for major public products.

Run `scripts/check-a11y-tooling.sh` (bundled with this skill) to detect what
a11y tooling the project already has before adding any — prefer what's
installed, and never add a paid/recurring service without Jesse's explicit
approval.

In a headless/CI environment where manual screen-reader or zoom checks can't
be performed, do what layers you can and **report the unperformed manual
checks as open risks** — never imply coverage that didn't happen.

### 4. Before calling it done

Run the self-check: keyboard-only pass · visible focus · accessible names on
every control · screen reader can complete the core flow · contrast + target
size · zoom/reflow + text scaling · errors/status announced · reduced motion
honored. For releases, work through
`docs/accessibility/ACCESSIBILITY_RELEASE_CHECKLIST.md` — an unresolved
**BLOCKER** or **CRITICAL** issue stops the release unless Jesse grants an
explicit, recorded exception. Log other findings with
`docs/accessibility/ACCESSIBILITY_ISSUE_TEMPLATE.md`; record major audits in
`docs/accessibility/audits/` (date-stamped, never overwriting prior audits).

## Claims — wording that matters

Never state a product is "100% ADA compliant," "certified," or legally immune;
never present a Lighthouse score or zero axe violations as proof of
accessibility; never say accessibility is "verified" for tests that weren't
actually run. The truthful framing is: *"We target and test against WCAG 2.2
Level AA,"* with known limitations disclosed and dated (see
`docs/accessibility/ACCESSIBILITY_STATEMENT_TEMPLATE.md`).

## Reference map

| Need | Read |
|---|---|
| Governing policy, scope, Definition of Done, exceptions | `docs/accessibility/ACCESSIBILITY_STANDARD.md` |
| How to build it (by topic, per stack) | `docs/accessibility/ACCESSIBILITY_ENGINEERING_GUIDE.md` |
| How to test it (layers, per-stack tooling, CI) | `docs/accessibility/ACCESSIBILITY_TESTING.md` |
| Ship gate + severity definitions | `docs/accessibility/ACCESSIBILITY_RELEASE_CHECKLIST.md` |
| Which law applies to which client | `docs/accessibility/JURISDICTION_MATRIX.md` |
| Filing an issue / audit / public statement | `ACCESSIBILITY_ISSUE_TEMPLATE.md`, `ACCESSIBILITY_AUDIT_TEMPLATE.md`, `ACCESSIBILITY_STATEMENT_TEMPLATE.md` |
| Authoritative external sources | `docs/accessibility/SOURCES.md` |
