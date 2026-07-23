# Accessibility Engineering Guide

How we build to **WCAG 2.2 Level AA** (web) and to WCAG 2.2 A+AA + native
platform requirements (mobile). Policy: `ACCESSIBILITY_STANDARD.md`. Testing:
`ACCESSIBILITY_TESTING.md`.

**First rule:** prefer **semantic HTML / native platform controls** before ARIA
or custom widgets. The most robust accessibility is the kind you don't have to
re-implement. **Second rule:** the DOM/visual tree is not the accessibility
tree — verify with a screen reader, don't assume.

---

## 1. Semantic structure

- **Semantic HTML:** `<button>`, `<a href>`, `<nav>`, `<main>`, `<header>`,
  `<footer>`, `<h1>`–`<h6>`, `<ul>/<ol>/<li>`, `<table>` with `<th scope>`,
  `<label>`, `<fieldset>/<legend>`. Don't rebuild these with `<div>`+ARIA unless
  you must.
- **Headings:** exactly one `<h1>` per page/view that names it; nested levels
  with **no skipped levels**; headings describe structure, not styling. Don't
  pick a heading level for its font size.
- **Landmarks:** one `<main>`; `<nav>` (label multiples with `aria-label`);
  `<header>`/`<footer>` as banner/contentinfo. Every focusable region should sit
  in a landmark.
- **Lists:** real `<ul>/<ol>` for lists so screen readers announce count and
  position.
- **Tables:** data tables use `<caption>`, `<th scope="col|row">`, and `<thead>/
  <tbody>`. Never use tables for layout.
- **Buttons vs links:** `<a href>` **navigates** (has a URL, can be opened in a
  new tab); `<button>` **performs an action** (submit, toggle, open dialog). A
  clickable `<div>`/`<span>` is neither — don't.
- **Accessible names:** every control has a name from visible text, `<label>`,
  `aria-label`, or `aria-labelledby`. Icon-only controls **must** have a name.
  Prefer visible text; if `aria-label` differs from visible text, the visible
  text should be contained in the accessible name (WCAG 2.5.3 Label in Name).
- **Page titles:** unique, descriptive `<title>` per page/route (WCAG 2.4.2).
- **Language:** `<html lang="…">`; mark inline language changes with `lang`.
- **Reading/DOM order:** the DOM order matches the meaningful reading and tab
  order; don't reorder with CSS in a way that separates visual and focus order.

## 2. Keyboard access (all functionality works without a mouse)

- **Keys:** `Tab`/`Shift+Tab` move between controls; `Enter` activates
  links/buttons; `Space` activates buttons/checkboxes; `Esc` closes
  dialogs/menus/popovers; **arrow keys** move within composite widgets (menus,
  tabs, radio groups, listboxes, grids) per the WAI-ARIA APG.
- **Focus order** follows meaning; **focus is always visible** (WCAG 2.4.7) and
  meets the 2.2 **Focus Not Obscured** (2.4.11) and **Focus Appearance** (2.4.13)
  expectations — don't remove outlines without an equal-or-better replacement.
- **No keyboard trap** (WCAG 2.1.2): focus can always move out (except an
  intentional modal, which traps only until dismissed).
- **Focus management:** move focus to opened dialogs/menus; **restore** focus to
  the trigger on close; after route changes, move focus to a sensible target
  (see §React/Next). Never leave focus on a removed element.
- **Skip navigation:** a "Skip to main content" link as the first focusable
  element (WCAG 2.4.1).
- **Custom controls:** if you must build one, implement the full APG keyboard
  model (roles, states, arrow-key semantics) and test it — a `role="button"`
  `<div>` also needs `tabindex="0"` and `Enter`/`Space` handlers.
- WCAG 2.2: **Dragging Movements** (2.5.7) — any drag interaction needs a
  single-pointer (click/tap) alternative.

## 3. Forms

- **Labels** programmatically associated (`<label for>` / wrapping `<label>` /
  `aria-labelledby`) — placeholder text is **not** a label.
- **Instructions** and formats are given before the field; **required** fields
  are indicated in text/`aria-required`, not by color/asterisk alone.
- **Validation:** errors are announced and **associated** with their field
  (`aria-describedby`), focus moves to the first error or an **error summary**
  (a labeled, focusable list linking to fields); use `aria-invalid`. Announce via
  a live region (`role="alert"`).
- **Autocomplete:** set `autocomplete` tokens for personal-data fields (WCAG
  1.3.5 Identify Input Purpose).
- **Accessible authentication** (WCAG 2.2 3.3.8): don't require a cognitive test
  (transcribing, puzzles, memorizing) with no alternative; allow paste, password
  managers, OTP autofill; don't block copy/paste on password/OTP fields.
- **Redundant entry** (WCAG 2.2 3.3.7): don't force re-entering info already
  provided in the same process (offer autofill/carry-forward).
- **Preserve input:** don't wipe entered data on validation error; keep it on
  navigation where reasonable.
- **Never rely on color alone** for state (error/success/required).

## 4. Color & visual design

- **Text contrast** ≥ **4.5:1** (normal), ≥ **3:1** for large text (≥24px, or
  ≥18.66px bold) — WCAG 1.4.3.
- **Non-text contrast** ≥ **3:1** for UI component boundaries, states, focus
  indicators, and meaningful graphics/icons — WCAG 1.4.11.
- **Focus indicators** are clearly visible and meet contrast/appearance.
- **Disabled states:** exempt from contrast minimums, but don't make a genuinely
  usable control look disabled, or convey "disabled" by low contrast alone.
- **Links** in body text are distinguishable from surrounding text by more than
  color alone (underline, or a 3:1 contrast difference **plus** another cue).
- **Charts/graphs/status:** never encode meaning in color only — add labels,
  patterns, direct labels, text, or icons; ensure series are distinguishable
  without color (WCAG 1.4.1 Use of Color).

## 5. Text & responsive design

- **Zoom:** never disable zoom (no `user-scalable=no` / `maximum-scale=1`).
- **Resize text** to 200% without loss (WCAG 1.4.4) and **reflow** at 320 CSS px
  width / 400% zoom without two-dimensional scrolling for a single-column of
  content (WCAG 1.4.10) — use responsive layout, relative units (`rem`), and
  container queries; avoid fixed heights that clip scaled text.
- **Text spacing** (WCAG 1.4.12): content survives increased line-height/letter/
  word/paragraph spacing — don't clip or overlap.
- **Orientation** (WCAG 1.3.4): don't lock to portrait/landscape unless
  essential.
- **Mobile scaling:** support **Dynamic Type** (iOS) and **Android font
  scaling**; use scalable text styles, not hard-coded point sizes.

## 6. Images

- **Meaningful images:** concise `alt` describing purpose/content.
- **Decorative images:** `alt=""` (or CSS background) so they're skipped.
- **Icons:** if informative, give an accessible name; if decorative alongside a
  text label, hide from AT (`aria-hidden="true"`).
- **SVG:** decorative → `aria-hidden="true"` + `focusable="false"`; meaningful →
  `role="img"` + `<title>`/`aria-label`.
- **Charts/diagrams/screenshots:** provide a text alternative or adjacent
  description conveying the same information; complex data → also offer the data
  as a table.
- **Image buttons/links:** the `alt`/name describes the **action/destination**,
  not the picture.

## 7. Media

- **Captions** for pre-recorded (WCAG 1.2.2) and live (1.2.4) audio in video.
- **Transcripts** for audio-only; **audio description** for video where visuals
  carry info not in the audio (1.2.3/1.2.5).
- **Autoplay:** avoid; if audio plays > 3s, provide a pause/stop/volume control
  (1.4.2). Prefer not to autoplay at all.
- **Flashing:** nothing flashes more than 3×/second (WCAG 2.3.1) — seizure risk.
- **Background audio:** keep low or provide a mute.

## 8. Motion

- Respect **`prefers-reduced-motion`** — reduce/disable non-essential animation,
  parallax, auto-advancing, and large transitions. Keep essential state changes
  instant rather than removing feedback.
- **Motion actuation** (WCAG 2.5.4): if a feature is triggered by device motion
  (shake/tilt), provide a UI alternative and a way to disable it.
- **Animation from interactions** (WCAG 2.3.3, AAA but adopt): allow disabling
  non-essential motion.

## 9. Touch & pointer input

- **Target size** (WCAG 2.2 2.5.8, AA): interactive targets are at least **24×24
  CSS px**, or have sufficient spacing. Prefer the **stronger platform minimums**
  where they improve UX: **iOS ~44×44 pt**, **Android ~48×48 dp**.
- **Pointer cancellation** (2.5.2): actions complete on **up**, not down; allow
  abort by moving off before release.
- **Dragging** (2.5.7) and **path-based gestures** (2.5.1): always offer a
  simple single-pointer alternative (buttons, taps).
- Never make a critical action depend on precise/small tapping or a
  hard-to-perform gesture.

## 10. Dynamic interfaces (patterns)

Use native HTML first; when custom, follow the **WAI-ARIA Authoring Practices
Guide** (APG). Test each with keyboard **and** a screen reader.

- **Dialog/modal/drawer:** `<dialog>` or `role="dialog"`+`aria-modal="true"`,
  labelled (`aria-labelledby`); move focus in, trap while open, `Esc` closes,
  restore focus to trigger; hide background from AT (`inert`/`aria-hidden`).
- **Tabs / accordions / menus / combobox / autocomplete:** follow APG roles,
  states, and arrow-key models. Combobox/autocomplete announce result counts and
  the active option (`aria-activedescendant`).
- **Drag-and-drop / sortable lists:** provide a keyboard alternative (move
  buttons, cut/paste, or a reorder control) — satisfies 2.5.7.
- **Tooltips / popovers:** reachable by keyboard, dismissible with `Esc`, and
  meet **Content on Hover or Focus** (WCAG 1.4.13): hoverable, persistent,
  dismissible.
- **Carousels:** pause control, keyboard operable, don't auto-advance without a
  stop; announce slide changes politely.
- **Toasts / alerts / status:** use live regions — `role="alert"`
  (`aria-live="assertive"`) for errors, `role="status"` (`aria-live="polite"`)
  for status; give the user time to read (avoid too-fast auto-dismiss for
  important info).
- **Loading / progress:** announce start/end (`aria-busy`, live region);
  determinate progress uses `role="progressbar"` with `aria-valuenow`.
- **Infinite scroll / dynamically inserted content:** announce new content or
  provide a "load more" control; keep focus stable; ensure keyboard users can
  reach a footer (infinite scroll can trap them away from it).

## 11. Screen readers (design and test for)

- **Web:** VoiceOver + Safari (macOS); NVDA + Firefox/Chrome (Windows) where
  available.
- **iOS:** VoiceOver. **Android:** TalkBack.
- The **accessibility tree ≠ the DOM/visual tree** — always verify names, roles,
  states, and reading order by listening, not by reading code.

## 12. React & Next.js

- **Routing / SPA nav:** on route change, **move focus** to a sensible target
  (the new `<h1>` or main region) and **announce** the new page via a polite live
  region — screen readers don't automatically announce client-side navigations.
- **Server Components / SSR (Next App Router):** render meaningful content and
  metadata server-side (unique `<title>`, `lang`) — see the browser-aware-design
  guide; a blank client shell also fails accessibility.
- **Hydration:** avoid content that only appears after JS; ensure interactive
  elements are real controls before/after hydration.
- **Forms:** associate labels, wire `aria-describedby` errors, use
  `role="alert"` for validation; server actions still need client-visible,
  announced error states.
- **Dialogs/components:** prefer a vetted accessible primitive (e.g., Radix UI,
  React Aria) over hand-rolled ARIA; still test it. Manage focus explicitly.
- **Icons/images:** icon-only buttons get `aria-label`; decorative icons
  `aria-hidden`. `next/image` still needs meaningful/empty `alt`.
- **Dynamic content:** wrap async status in live regions; don't rely on visual
  spinners alone.

## 13. React Native & Expo

Set properties that reflect the **actual** interaction and accessible-name
calculation — don't add them mechanically.

- `accessible` — groups children into one element with one name (use for
  composite rows/cards).
- `accessibilityLabel` — the name (when visible text is insufficient/absent).
- `accessibilityRole` — `button`, `link`, `header`, `image`, `switch`,
  `adjustable`, `alert`, etc.
- `accessibilityState` — `{ disabled, selected, checked, expanded, busy }`.
- `accessibilityValue` — `{ min, max, now, text }` for sliders/progress.
- `accessibilityHint` — extra guidance **only** when the action isn't obvious;
  keep it short, don't restate the label.
- `accessibilityLiveRegion` (Android) / announce via `AccessibilityInfo`
  (`announceForAccessibility`) for dynamic changes.
- `accessibilityViewIsModal` (iOS) for modals so AT ignores background.
- `importantForAccessibility` (Android) / `accessibilityElementsHidden` (iOS) to
  hide decorative/duplicate content.
- Respect `AccessibilityInfo.isReduceMotionEnabled` and OS text scaling
  (`allowFontScaling` default true — don't disable it).
- **Test on device** with VoiceOver and TalkBack — simulators/props are not
  proof.

## 14. Native iOS / Android (when building native)

- **iOS:** `isAccessibilityElement`, `accessibilityLabel/Value/Hint/Traits`,
  grouping, `accessibilityViewIsModal`, Dynamic Type (`UIFontMetrics` / text
  styles), VoiceOver rotor, honor Reduce Motion / Bold Text / larger text.
- **Android:** `contentDescription`, roles via `AccessibilityNodeInfo`, live
  regions, focus order, `android:importantForAccessibility`, touch target ≥48dp,
  support font scale, TalkBack testing.
- Follow Apple HIG and Android accessibility guidance (`SOURCES.md`).

## 15. Third-party / embedded components

Auth, payments, chat/support widgets, cookie banners, maps, date pickers,
rich-text editors, embedded video, CAPTCHA, document viewers, calendars, and
user-facing analytics UIs are **in scope**. Evaluate before adoption (request a
VPAT/ACR or test yourself). If a required component has gaps, document them and
provide an accessible path to the same outcome. For CAPTCHA, provide a
non-visual alternative. Popularity/price ≠ accessibility.

## 16. AI-generated / AI-modified UI

Any interface Claude (or another tool) generates or materially changes meets
this same standard. **Never knowingly trade accessibility for visual design
without explicitly flagging the conflict** and letting Jesse decide. Build the
accessible version first; don't defer accessibility to a later pass.

---

## Quick "before I call it done" self-check
Keyboard-only pass · visible focus · accessible names on every control · SR can
complete the core flow · contrast + target size · zoom/reflow + text scaling ·
errors/status announced · reduced motion honored · no BLOCKER/CRITICAL open. See
`ACCESSIBILITY_RELEASE_CHECKLIST.md`.
