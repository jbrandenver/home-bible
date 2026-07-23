# Accessibility Standard (Governing Policy)

**Owner:** Jesse Branson · **Status:** Active · **Applies to:** every
user-facing product we design, build, modify, review, test, or ship.

This is the governing policy. Implementation detail lives in
`ACCESSIBILITY_ENGINEERING_GUIDE.md`; testing in `ACCESSIBILITY_TESTING.md`;
legal mapping in `JURISDICTION_MATRIX.md` and `SOURCES.md`.

## Purpose

Make accessibility a **core engineering requirement** — designed and built in,
tested before "done," and maintained against regression — not a one-time audit
or a bolt-on. Accessible products are a legal, ethical, and quality obligation
and they are better products for everyone.

## Scope

All user-facing functionality across websites, web applications, SaaS, and
mobile applications, on every stack we use (React, TypeScript, Next.js, Vite,
Supabase-backed UIs, Expo, React Native, native iOS, native Android, and
related frameworks). Includes UI generated or materially modified by AI, and
user-facing documents (PDF/office) and third-party/embedded content.

## Default internal standard

- **Web / web apps / SaaS:** **WCAG 2.2 Level AA** is the default minimum
  product-development target.
- **Mobile apps:** WCAG 2.2 **Level A and AA** principles applied via WCAG2ICT /
  current W3C mobile guidance, **together with** native **Apple** and **Android**
  accessibility requirements and best practices (use the stronger platform
  recommendation where it gives a better experience).
- Where a governing law specifies a different standard, document **both**:
  - **LEGAL MINIMUM** — what the applicable law requires (see
    `JURISDICTION_MATRIX.md`).
  - **INTERNAL ENGINEERING STANDARD** — WCAG 2.2 AA (default), which is often
    newer/stricter than the legal minimum.

## Applicable legal frameworks (summary; see JURISDICTION_MATRIX.md)

- **ADA Title III** — private U.S. businesses; no codified WCAG version, WCAG is
  the benchmark.
- **ADA Title II** (2024 web rule) — U.S. state/local government; WCAG 2.1 AA.
- **Section 508** — U.S. federal; WCAG 2.0 AA.
- **Colorado HB21-1110** (as amended by HB24-1454) — CO state/local government;
  WCAG 2.1 AA.
- **European Accessibility Act / EN 301 549** — EU consumer services/products.
- **WCAG2ICT** — applying WCAG to documents and non-web software.

We do **not** treat these as interchangeable. The matrix records which applies
to which client.

## Requirements

### Web requirements
Semantic structure, full keyboard operability, accessible names/roles/states,
managed focus, WCAG 2.2 AA color/contrast and target size, resize/reflow to
400% and at 320px width, reduced-motion support, accessible forms and error
handling, and screen-reader-verified core workflows. Detail:
`ACCESSIBILITY_ENGINEERING_GUIDE.md`.

### Native mobile requirements
Correct accessibility labels/roles/values/hints, logical accessibility order
and focus, screen-change announcements, Dynamic Type / font scaling, adequate
touch targets, gesture alternatives, orientation support, reduced motion,
contrast, and accessible native dialogs/sheets — verified with **VoiceOver**
(iOS) and **TalkBack** (Android). Detail: engineering guide → mobile sections.

### Document / PDF requirements
User-facing PDFs and office documents must be tagged, have a logical reading
order, real text (not scanned images without OCR), alt text on meaningful
images, correct heading structure, table headers, document language and title,
and accessible forms. Prefer accessible HTML over PDF when possible. Apply
WCAG2ICT. If a document cannot be made accessible in time, provide an accessible
alternative and record it as a known limitation.

### Third-party / embedded software requirements
Auth providers, payment UIs, chat/support widgets, cookie banners, maps, date
pickers, rich-text editors, embedded video, CAPTCHA, document viewers, calendars,
and analytics UIs shown to users are **in scope**. A component is **not** assumed
accessible because it is popular or paid. Evaluate before adoption; prefer
accessible alternatives; if a required third-party component has gaps, document
them and provide an accessible path to the same outcome.

### Procurement requirements
Before adopting third-party UI, request an accessibility conformance report
(VPAT®/ACR) or evaluate it ourselves against WCAG 2.2 AA. Record the result.
Do not procure an accessibility **overlay/widget** as a substitute for accessible
source (see "Cost & overlays").

### Development requirements
Accessibility is addressed **during** implementation, not deferred. Prefer
semantic HTML / native platform controls before ARIA or custom controls. New
UI is built to WCAG 2.2 AA. The **accessibility skill** is invoked and followed
for all user-facing UI work.

### Testing requirements
Four layers, all required for meaningful assurance: static/lint, automated
browser (axe), **manual** (keyboard + screen reader + zoom/reflow), and — for
major public products — periodic testing with people who use assistive
technology. Automated results alone are **never** treated as proof of
accessibility. Detail: `ACCESSIBILITY_TESTING.md`.

### Release requirements
No production release with an unresolved accessibility **BLOCKER** or
**CRITICAL** issue unless Jesse grants an explicit, recorded exception. See
`ACCESSIBILITY_RELEASE_CHECKLIST.md` for gates and severity definitions.

### Remediation requirements
Confirmed issues are triaged by severity and user impact, mapped to WCAG
criteria, tracked (`ACCESSIBILITY_ISSUE_TEMPLATE.md`), and fixed in the app's
real markup/components/styling/behavior. Major remediations are documented in
`audits/` with before/after, fix, testing performed, and remaining limitations.

### Accessibility feedback requirements
Every public product provides a clearly reachable way to report accessibility
problems (see `ACCESSIBILITY_STATEMENT_TEMPLATE.md`) and a defined response
process. Some jurisdictions (e.g., Colorado) require a prominent feedback
mechanism — treat it as mandatory for government clients.

## Ownership

Jesse Branson owns this standard and grants release exceptions. Each project
should name a person responsible for accessibility outcomes; absent that, the
implementing engineer owns it for the change they make.

## Recordkeeping

Keep audits date-stamped in `docs/accessibility/audits/` (never overwrite prior
audits). Keep conformance notes, exception approvals, and third-party
evaluations. Preserve history so we can show diligence and track regressions.

## Exceptions process

1. Identify the specific issue, WCAG criterion, severity, and affected users.
2. Provide the reason an exception is requested and any interim accessible
   alternative.
3. Jesse reviews and records an explicit, time-bound approval with a remediation
   date. BLOCKER/CRITICAL exceptions are the only ones that can gate a release,
   and only with this recorded approval.
4. Track the exception to closure. An exception is not a permanent waiver.

## Definition of Done (accessibility is part of it)

A user-facing feature is **not done** until:
- It is fully operable by keyboard (web) / assistive tech (mobile), with visible
  focus and no traps.
- All interactive elements have correct accessible names, roles, and states.
- The core workflow is completable with a screen reader (VoiceOver/NVDA/TalkBack
  as applicable).
- Color is never the sole means of conveying meaning; contrast and target-size
  criteria pass.
- It resizes/reflows and respects reduced-motion / OS text-scaling.
- Errors, alerts, status changes, and dynamic content are announced.
- Automated a11y checks pass **and** the required manual checks were performed.
- Any unresolved accessibility risk is reported, and **no BLOCKER/CRITICAL issue
  remains** (or a recorded exception exists).

## Claims we never make

- Never state a product is "100% ADA compliant," "certified ADA compliant," or
  "legally protected/immune from accessibility claims."
- Never present passing automated tools (Lighthouse, zero axe violations) as
  proof of accessibility.
- Never describe meeting WCAG 2.2 AA as permanent legal compliance or immunity.
- Never claim accessibility is "verified" when the required testing has not
  actually been performed.
- Never recommend an accessibility overlay/widget as a compliance solution.

Truthful framing: *"We target and test against WCAG 2.2 Level AA"* — with known
limitations disclosed and dated (see `ACCESSIBILITY_STATEMENT_TEMPLATE.md`).

## Cost & overlays

Accessibility is achieved in our own source, not bought as a subscription. No
overlay widget is a substitute for accessible code. No paid accessibility
software or recurring-cost service is added without Jesse's explicit approval and
an up-front statement of the cost.
