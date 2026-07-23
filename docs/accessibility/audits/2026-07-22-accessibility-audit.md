# Accessibility Audit — Our Home Folder (apps/web) — 2026-07-22

> Dated record of a **code-level, static** review. Not a certification and not a
> guarantee of legal compliance. Manual assistive-technology testing (keyboard,
> screen reader, zoom/reflow, mobile) was **not** performed — see "Test coverage"
> and "Unresolved risks".

## Executive summary

- **Project:** Our Home Folder — `apps/web` (Next.js 14 Pages Router, TypeScript,
  Supabase). Shared UI in `packages/ui` (`@home-folder/ui`).
- **Date:** 2026-07-22
- **Auditor:** Claude (automated code-level review), for Jesse Branson
- **Platforms:** Web (responsive; public marketing + legal + auth surface, plus
  an authenticated single-page app behind login)
- **Standard evaluated:** WCAG 2.2 Level AA (internal). Legal minimum depends on
  audience (US consumer product → ADA Title III risk; see `JURISDICTION_MATRIX.md`
  for a formal determination — not done here).
- **Jurisdiction considerations:** Consumer SaaS operated by JBran LLC (Colorado).
  Public pages are the externally reachable surface most exposed to ADA-style
  claims; auth is a legal-minimum-sensitive flow. Confirm applicable framework
  with counsel.
- **Overall assessment:** Structurally sound for a heavy-inline-style app —
  semantic HTML throughout, real `<button>`/`<a>`, one `<h1>` per page via
  `PageHeader`, `<html lang>`, landmarks, labelled form fields, `<fieldset>`/
  `<legend>` on the visibility picker, `prefers-reduced-motion` honored, 44px
  primary controls, and **zero jsx-a11y lint findings**. The recurring gaps are
  in the **feedback and focus layer**: focus indicators and some link/status text
  fall below contrast minimums, form/async errors are not announced to screen
  readers, and inline text links are distinguished by color alone. No blocker was
  found in code, but several items are HIGH and sit on the public/auth surface.
- **Critical findings:** 0
- **High findings:** 3
- **Medium findings:** 6
- **Low findings:** 1
- **Blocker findings:** 0

_Static review cannot confirm a BLOCKER/CRITICAL is absent — a screen-reader pass
on auth and the record forms is still required before that can be stated._

## Findings

| ID | WCAG criterion | Level | Component / page | Problem | Affected users | Severity | Evidence | Recommended remediation | Status |
|----|----------------|-------|------------------|---------|----------------|----------|----------|-------------------------|--------|
| A11Y-001 | 1.4.11 Non-text Contrast; 2.4.7/2.4.13 Focus Visible/Appearance | AA | App-wide focus ring (`styles/globals.css` L111-117, L278, L411) | Keyboard focus outline is `2px solid var(--color-brass)` `#C8923F` = **2.38:1** on paper, **2.53:1** on card, below the 3:1 minimum. Input focus is a faint `rgba(200,146,63,0.22)` box-shadow + brass border (~2.6:1). Fails on the light backgrounds that dominate the app, including public pages. | Keyboard users; low-vision users | **HIGH** | Computed ratios: brass on `#F5EEDD`=2.38, on `#FBF5E8`=2.53, on `#FDF9EF`=2.61. | Use a focus color ≥3:1 on light surfaces (e.g. `--color-espresso`, or `--color-brass-deep` #9C6D26 = 3.9:1) and/or a thicker/offset double-ring; strengthen the input focus ring to a solid ≥3:1 outline. | Open |
| A11Y-002 | 1.4.1 Use of Color | A | Auth (`sign-in.tsx` L118-120, `sign-up.tsx` L116-118); legal + footer links (`privacy.tsx`, `terms.tsx`, `Layout.tsx` L114-117) | Inline text links are signalled by color alone with no underline. Worst case: the "Create an account" / "Sign in" links sit inside a muted `<p>` and inherit its color (`a{color:inherit}`) with no underline, so they are **visually identical** to surrounding text. Legal/footer/"Account settings" links use `--color-brass-deep` with underline only on hover. | Color-blind, low-vision, cognitive | **HIGH** | `a{color:inherit}` (globals L83); legal links `style={{color:'var(--color-brass-deep)'}}` no `text-decoration`; footer underline only `:hover`. | Underline inline text links in their default state (or add an equivalent non-color cue); give the auth "Create an account"/"Sign in" links a distinct, underlined style. | Open |
| A11Y-003 | 4.1.3 Status Messages (also 3.3.1 association) | AA (A) | Every form's error state (`setError` in ~39 pages incl. `sign-in.tsx` L95, `sign-up.tsx` L81, `create-property.tsx` L153-157); `PhotoCaptureButton` status L83-93 | Errors and async status render as plain `<p>`/`<span>` with no `role="alert"`/`aria-live`; loading text ("Signing in…") is not announced either. Errors are also not programmatically tied to their field (`aria-describedby`/`aria-invalid`). Only `ErrorBoundary` uses `role="alert"`. On auth (a core, public flow) a screen-reader user gets no notification that sign-in failed. | Screen-reader users | **HIGH** | Grep: `aria-live`/`role="status"` absent from `pages/`; 39 files call `setError`. | Render form errors/status in a live region (`role="alert"` for errors, `role="status"` for status), move focus to the first error or an error summary, and wire `aria-describedby`/`aria-invalid` on the inputs. | Open |
| A11Y-004 | 1.4.3 Contrast (Minimum) | AA | `--color-brass-deep` as text: links, "attention" status, `UtilityBadge` attention tone (`packages/ui/src/index.tsx` L257-263) | `--color-brass-deep` `#9C6D26` = **4.18:1** on card and **3.81:1** on the pale badge background (11px uppercase mono) — below 4.5:1 for normal-size text. Used for inline links, "attention"/"due/pending/open" status text, and attention-tone badges. | Low-vision users | **MEDIUM** | Computed: brass-deep on `#FBF5E8`=4.18; on badge bg `#F6EAD3`=3.81; clay/sage tones pass (~4.8). | Darken brass-deep for text use (≈`#875C1E` reaches ≥4.5) or increase size/weight of badge/status text; re-check all tones on the badge background. | Open |
| A11Y-005 | 2.4.2 Page Titled | A | All authenticated pages (dashboard, assets, utilities, maintenance, documents, settings, automation, etc.) | Only the 5 public pages (`index`, `privacy`, `terms`, `sign-in`, `sign-up`) set a `<title>` via `<Seo>`. Authenticated pages set no per-page title, so they share a single generic/empty document title. | Screen-reader users; all users (tabs/history) | **MEDIUM** | Grep: `next/head`/`<title>` only in the 5 Seo pages; none in `_document`/`_app`. | Add a per-page `<title>` (a lightweight `<Head>` title or a shared `PageTitle` helper) to authenticated pages. | Open |
| A11Y-006 | 1.3.5 Identify Input Purpose (supports 3.3.8) | AA | `sign-in.tsx`, `sign-up.tsx`, other personal-data forms | No `autoComplete` attribute anywhere in the app. Email/password fields should declare `autocomplete="email"`, `"current-password"`, `"new-password"` so password managers and browser autofill work reliably. Paste is not blocked, so the 3.3.8 minimum is otherwise met. | Motor/cognitive; password-manager users | **MEDIUM** | Grep: `autoComplete` absent from `pages/`, `components/`. | Add correct `autocomplete` tokens to email/password and other personal-data inputs. | Open |
| A11Y-007 | 2.4.3 Focus Order; 2.1.2 No Keyboard Trap; 4.1.2 Name/Role/Value | A | `ConfirmDialog` (`packages/ui/src/index.tsx` L308-381) | Modal has `role="dialog"`, `aria-modal`, `aria-labelledby` but **no focus management**: focus is not moved into the dialog, not trapped, `Esc` does not close, focus is not restored to the trigger, and the background is not inert/`aria-hidden`. Currently **not imported by any page** (dormant), but it ships in the shared UI package and will fail the moment it is used. | Keyboard + screen-reader users (once used) | **MEDIUM** (latent) | Grep: `ConfirmDialog`/`UndoToast` have no usages in `pages`/`components`. | Before first use, adopt a vetted primitive (Radix Dialog / React Aria) or implement the full APG dialog pattern (focus in/trap/restore, Esc, background inert). | Open |
| A11Y-008 | 2.4.1 Bypass Blocks | A | `components/Layout.tsx` (header nav L56-101; `<main>` L104) | No "Skip to main content" link, and `<main>` has no `id`/target. Every page repeats a multi-row header (brand + status + auth + up to 6 primary nav links), forcing keyboard users to tab through all of it on each navigation. Landmarks exist (so 2.4.1 is technically met via landmark navigation), but the skip link is expected by the release checklist. | Keyboard users; screen-reader users | **MEDIUM** | `Layout.tsx`: `<main className="p-6 app-main">` has no id; no skip anchor as first focusable element. | Add a visually-hidden-until-focused skip link as the first focusable element targeting `<main id="main" tabIndex={-1}>`. | Open |
| A11Y-009 | 1.4.3 Contrast; 1.4.11 Non-text Contrast | AA | Paper-grain overlay (`styles/globals.css` L72-81) | `body::before` is a full-viewport noise texture at `z-index:2000`, `opacity:0.5`, `mix-blend-mode:multiply`, layered over **all** content — text, controls, and focus rings. It darkens/adds noise to everything and erodes already-thin contrast margins (A11Y-001 focus 2.38, A11Y-004 links 4.18). The effect is small per-pixel but universal and unmeasured. | Low-vision users | **MEDIUM** (verify) | Fixed overlay above app layers; multiply blend reduces light-on-dark and adds grain over body text. | Measure post-composite contrast on representative screens; if margins are lost, lower opacity, exclude text/controls, or drop the overlay below the interactive layer. | Open |
| A11Y-010 | 2.5.8 Target Size (Minimum) | AA | Icon-only remove buttons (`automation/automations/[id].tsx` L287, `automation/devices/[id].tsx` L445) | `<button aria-label="Remove">×</button>` with `border:0`, transparent background, and no min-size — likely below 24×24 CSS px. Accessible names are present (good). Authenticated surface, lower exposure. | Motor-impaired; touch users | **LOW** | Inline styles set no padding/min dimensions on the `×` control. | Give the control ≥24×24 px (padding or explicit min-width/height) with adequate spacing. | Open |

_Severity per `ACCESSIBILITY_RELEASE_CHECKLIST.md`. Every finding maps to a WCAG
success criterion. "Affected users" names the primary assistive-tech/disability
group._

## What was verified as correct (not exhaustive)

- Semantic HTML throughout; **no clickable `<div>`/`<span>`** (grep clean).
- `<html lang="en">` set in `_document.tsx`.
- One `<h1>` per page via `PageHeader`; heading levels on landing/legal descend
  without skips; `EmptyState`/`RelatedList` use `<h2>`, cards `<h3>`.
- Landmarks present: `<nav>` (footer nav labelled `aria-label="Legal"`),
  `<main>`, `<header>`, `<footer>`; hero/related cards use `<section>`.
- Form fields have associated labels (wrapping `<label>` on auth, `htmlFor`/`id`
  on create-property); the visibility picker uses `<fieldset>/<legend>` + a
  labelled `role="group"` with real checkboxes.
- Icon-only controls that exist carry `aria-label` (remove `×`, invitation link,
  connection map `role="img"`); decorative dots/rules/dots-leaders are
  `aria-hidden`; the document thumbnail is `alt=""` (decorative, title shown as
  text alongside).
- `prefers-reduced-motion: reduce` disables the page-reveal animations.
- Primary controls (`getControlStyle`, `Button`, `ActionLink`, `ErrorBoundary`
  buttons) set `minHeight:44`.
- Muted body text (`--text-muted` greige `#6B5F4E`) = 5.4–5.9:1 — passes.
- Dark header/hero light text (all alpha tiers 0.6–0.85) = 6.3–11.2:1 — passes.
- No `user-scalable=no`/`maximum-scale` (Next.js default viewport allows zoom).
- jsx-a11y (via `next/core-web-vitals`): **0 findings** (only an unrelated
  `react-hooks/exhaustive-deps` warning). Note jsx-a11y only catches static JSX
  issues (missing alt, label-less controls, bad ARIA) — it cannot see the
  contrast, focus-visibility, live-region, or focus-management gaps above.

## Test coverage performed

- **Keyboard test:** NOT performed (no manual keyboard pass). Reviewed statically
  — tab order follows DOM, no positive `tabindex`, no keyboard traps in code,
  but focus **visibility** fails contrast (A11Y-001) and the dialog's focus
  management is unimplemented (A11Y-007).
- **Screen-reader test:** NOT performed (no NVDA/VoiceOver run). Static review
  flags un-announced errors/status (A11Y-003) and missing page titles (A11Y-005).
- **Visual test:** Contrast computed from CSS tokens (findings above). Zoom/reflow
  at 320px/400%, text-spacing, and reduced-motion behavior were NOT visually
  verified (reduced-motion is present in CSS).
- **Mobile test:** NOT performed (no device/emulator). Layout is responsive with a
  fixed bottom nav; touch-target sizing on the `×` controls flagged (A11Y-010).
- **Automated scan:** ESLint `jsx-a11y` via `next lint` — 0 a11y findings
  (partial by nature; static JSX only). `vitest-axe` is installed but no axe
  assertions were executed against rendered routes as part of this audit.
- **Document test:** N/A (app generates printable/plain-text sheets; PDF tagging
  not in scope here).
- **Third-party integrations:** Supabase Auth email/password + Google/Apple OAuth
  redirects. The OAuth providers' hosted screens were NOT evaluated (external);
  the in-app buttons are labelled real `<button>`s. No CAPTCHA present. No cookie
  banner (privacy policy states no advertising/tracking cookies).

## Unresolved risks & open items

- **A screen-reader pass on auth and the record forms is required** before anyone
  can state no BLOCKER/CRITICAL exists — A11Y-003 (silent errors) on the sign-in
  flow is the most likely candidate to escalate to CRITICAL if a screen-reader
  user cannot tell that authentication failed.
- Keyboard-only walkthrough of the authenticated app (nav, forms, any future use
  of `ConfirmDialog`) is outstanding.
- Zoom/reflow at 320px and 400%, and text-spacing overrides, were not visually
  verified — the heavy inline fixed pixel sizing warrants a manual check.
- The paper-grain overlay (A11Y-009) needs on-screen contrast measurement, not
  just token math, because `mix-blend-mode: multiply` composites with real pixels.
- Authenticated pages are client-loaded behind login; their live DOM (dynamic
  lists, status badges, any menus/sheets rendered at runtime) was reviewed from
  source only, not exercised in a browser.
- Jurisdiction/legal-framework determination is out of scope — refer to
  `JURISDICTION_MATRIX.md` and counsel.

## Prioritized remediation plan

1. **HIGH (fix before the next public release if feasible):**
   - A11Y-001 Focus indicator contrast (single CSS token change, app-wide win).
   - A11Y-003 Announce + associate form/auth errors (start with `sign-in`/
     `sign-up`, then generalize the pattern).
   - A11Y-002 Underline inline text links (auth links first, then legal/footer).
2. **MEDIUM (schedule with a target date):** A11Y-004 brass-deep text contrast ·
   A11Y-005 per-page titles · A11Y-006 autocomplete tokens · A11Y-008 skip link ·
   A11Y-009 verify/adjust paper-grain overlay · A11Y-007 fix `ConfirmDialog`
   before its first use.
3. **LOW (backlog):** A11Y-010 enlarge icon-only `×` targets.

Keep remediation scoped to the accessibility issues above — do not bundle
unrelated refactors. Log each open item with `ACCESSIBILITY_ISSUE_TEMPLATE.md`.
