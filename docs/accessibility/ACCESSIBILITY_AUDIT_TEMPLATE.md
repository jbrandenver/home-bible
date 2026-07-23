# Accessibility Audit — <Project> — <YYYY-MM-DD>

> Copy to `docs/accessibility/audits/YYYY-MM-DD-accessibility-audit.md`. Never
> overwrite a prior audit — each is a dated record. This audit reflects testing
> performed on the date shown and is **not** a certification or a guarantee of
> legal compliance.

## Executive summary

- **Project:**
- **Date:**
- **Auditor:**
- **Platforms:** (web / iOS / Android / documents)
- **Standard evaluated:** WCAG 2.2 Level AA (internal) · Legal minimum: <e.g.,
  ADA Title III / Section 508 / EAA — see JURISDICTION_MATRIX.md>
- **Jurisdiction considerations:** <who the users/clients are; which framework
  applies; anything needing legal review>
- **Overall assessment:** <plain-language state; do not claim full compliance>
- **Critical findings:** <count>
- **High findings:** <count>
- **Medium findings:** <count>
- **Low findings:** <count>

## Findings

| ID | WCAG criterion | Level | Component / page / screen | Problem | Affected users | Severity | Evidence | Recommended remediation | Status |
|----|----------------|-------|---------------------------|---------|----------------|----------|----------|-------------------------|--------|
| A11Y-001 | 1.4.3 Contrast (Minimum) | AA | | | | HIGH | | | Open |
| A11Y-002 | 2.1.1 Keyboard | A | | | | BLOCKER | | | Open |

_Severity: BLOCKER / CRITICAL / HIGH / MEDIUM / LOW (see release checklist).
Map every finding to a WCAG success criterion. "Affected users" = which
assistive-tech / disability groups._

## Test coverage performed

- **Keyboard test:** <scope, result>
- **Screen-reader test:** <VoiceOver/NVDA/TalkBack — which flows, result>
- **Visual test:** <contrast, zoom/reflow, text spacing, reduced motion>
- **Mobile test:** <iOS VoiceOver / Android TalkBack / Dynamic Type / targets>
- **Automated scan:** <tools + versions; routes covered; note it's partial>
- **Document test:** <PDFs/office docs, if any>
- **Third-party integrations:** <auth, payments, chat, maps, CAPTCHA, etc. —
  evaluated? gaps? accessible alternative?>

## Unresolved risks & open items

- <Known limitations, manual tests still required, AT-user testing recommended,
  items needing legal review.>

## Prioritized remediation plan

1. All BLOCKER/CRITICAL first (these gate release).
2. HIGH with a target date.
3. MEDIUM/LOW to backlog.

Remediation should stay scoped to the accessibility issues — do not bundle
unrelated architectural changes.
