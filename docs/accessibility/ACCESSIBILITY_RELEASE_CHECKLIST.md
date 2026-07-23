# Accessibility Release Checklist

Run before shipping user-facing changes. A **BLOCKER** or **CRITICAL** issue
**stops the release** unless Jesse grants an explicit, recorded exception
(`ACCESSIBILITY_STANDARD.md` → Exceptions). **A Lighthouse score or zero axe
violations is not a pass** — the manual checks below are required.

## Severity levels

| Severity | Meaning | Release effect |
|---|---|---|
| **BLOCKER** | A core task is impossible for a group of users (e.g., can't authenticate, check out, or submit with keyboard/SR). | **Must fix** before release |
| **CRITICAL** | Core task possible but severely impaired, or a legal-minimum criterion fails on a key flow. | **Must fix** before release |
| **HIGH** | Significant barrier with a workaround; important criterion fails off the critical path. | Fix before release if feasible; else scheduled with a date |
| **MEDIUM** | Noticeable friction, limited scope. | Backlog with a target |
| **LOW** | Minor/cosmetic; best-practice gap. | Backlog |

### Release blockers (non-exhaustive) — any of these blocks release
- A major workflow is not operable by keyboard.
- Authentication is inaccessible (unlabeled fields, keyboard/SR can't complete,
  cognitive-test CAPTCHA with no alternative).
- Required controls are unlabeled (no accessible name).
- A screen reader cannot complete a core workflow.
- A keyboard trap exists.
- Focus is completely lost during a required interaction.
- Critical information is conveyed only visually (color/position/icon with no
  text or programmatic equivalent).
- Payment or signup process is inaccessible.
- A major color-contrast failure affects required content.

## Pre-release checklist

**Automated (necessary, not sufficient)**
- [ ] Lint (jsx-a11y) passes on changed UI.
- [ ] Automated a11y assertions (axe) pass for affected routes/components.
- [ ] No console axe violations in dev on the changed screens.

**Keyboard**
- [ ] Every interactive element is reachable and operable by keyboard.
- [ ] Focus order is logical; focus is always visible.
- [ ] No keyboard traps; `Esc` closes overlays; skip link works.
- [ ] Focus moves into dialogs and is restored on close; moves sensibly on route
      change.

**Screen reader (the core flow, on the right AT for the platform)**
- [ ] All controls announce correct name, role, and state.
- [ ] The primary workflow can be completed end-to-end with a screen reader.
- [ ] Dynamic changes (errors, status, loading, new content) are announced.

**Visual / responsive**
- [ ] Text & non-text contrast meet WCAG 2.2 AA on required content.
- [ ] Color is never the only signal.
- [ ] 200% text / 400% zoom / 320px reflow works; text-spacing survives.
- [ ] OS text scaling (Dynamic Type / Android) respected (mobile).
- [ ] Reduced-motion respected.

**Touch (mobile / touch web)**
- [ ] Targets meet 24px (WCAG) / prefer 44pt iOS / 48dp Android; adequate
      spacing.
- [ ] Gestures/drag have single-pointer alternatives.

**Forms**
- [ ] Labels associated; required/instructions in text; errors associated &
      announced; input preserved; autocomplete set; auth is accessible.

**Content & third-party**
- [ ] Images have correct alt (meaningful) or are hidden (decorative).
- [ ] Media has captions/transcripts as required.
- [ ] Any new third-party/embedded UI evaluated; gaps documented with an
      accessible alternative.
- [ ] User-facing documents/PDFs are tagged/accessible or an accessible
      alternative is provided.

**Sign-off**
- [ ] Manual checks above were **actually performed** (not assumed).
- [ ] No open BLOCKER/CRITICAL (or a recorded exception exists).
- [ ] Open HIGH/MEDIUM/LOW logged with `ACCESSIBILITY_ISSUE_TEMPLATE.md`.
- [ ] Unresolved accessibility risks reported to Jesse.
- [ ] For a major release: audit recorded in `docs/accessibility/audits/`.

> Report honestly which manual tests were done and which remain. Do not state
> accessibility is verified for tests that were not run.
