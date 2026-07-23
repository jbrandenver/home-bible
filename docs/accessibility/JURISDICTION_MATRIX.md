# Jurisdiction Matrix

A decision aid for picking the **legal minimum** and confirming our **internal
engineering standard** for a given project. This is engineering guidance, **not
legal advice** — obtain qualified counsel for compliance decisions and before
publishing any accessibility or compliance claim. Reverify dates against
`SOURCES.md`; standards and deadlines change.

**Internal engineering standard (all rows, unless a stricter law applies):**
**WCAG 2.2 Level AA** for web/web apps; WCAG 2.2 A+AA principles plus native
Apple/Android guidance for mobile apps. The internal target is often *newer/
stricter* than the legal minimum — meeting it is good engineering, not legal
immunity.

| Audience / client | Potential governing framework | Legal technical baseline | Additional requirements | Documentation | Legal review? |
|---|---|---|---|---|---|
| **Private U.S. business** (public accommodation) | ADA Title III; state UnruhAct/consumer laws | No single codified WCAG version; DOJ treats WCAG as the benchmark, courts commonly apply **WCAG 2.1/2.2 AA** | Effective communication; accessible feedback path; remediate on complaint | Accessibility statement; audit history | Recommended for public claims / demand letters |
| **U.S. state or local government** | ADA Title II (2024 web rule) | **WCAG 2.1 Level AA** | Conform by the rule's deadline (see below); accessible docs; mobile apps in scope | Conformance records; remediation plan | Yes |
| **Colorado state/local govt** (incl. school districts) | ADA Title II **+** Colorado HB21-1110 (as amended by HB24-1454) | **WCAG 2.1 AA** (confirm current CO OIT technical standard) | Public accessibility feedback process; historically quarterly progress reporting during grace period | CO-specific conformance + feedback records | Yes |
| **U.S. federal government / federal contractor** | Section 508 (Rehabilitation Act) | **WCAG 2.0 Level AA** (incorporated by Revised 508 Standards) | Non-web documents & software also covered; VPAT/ACR on procurement | VPAT® / Accessibility Conformance Report | Yes |
| **EU consumer service / product** | European Accessibility Act (Dir 2019/882) | **EN 301 549** (≈ WCAG 2.1 AA today; aligns to 2.2 in later versions) | Accessibility statement per EU norms; conformity documentation; per-member-state enforcement | EU accessibility statement; technical conformity file | Yes |
| **Internal enterprise application** (employees) | ADA Title I (employment/accommodation); Section 508 if federal | No public-facing web mandate, but accommodation duties apply | Must not block an employee who uses assistive tech from doing their job | Internal conformance notes | Situational |
| **Native mobile application** | Same as the audience above (Title II rule explicitly covers mobile apps; EAA covers many apps) | Map WCAG 2.2 A+AA via **WCAG2ICT** / EN 301 549 Ch. 11 | Native **Apple** & **Android** platform accessibility requirements + best practices | Per-platform test evidence | Follows the audience row |

## ADA Title II web rule — compliance dates (verify at ada.gov)

The rule was published **April 24, 2024** (WCAG 2.1 AA). An **Interim Final Rule
(April 2026) extended** the original dates:

| Entity | Original date | Extended date (2026 IFR) |
|---|---|---|
| Public entity, population ≥ 50,000 | April 24, 2026 | **April 26, 2027** |
| Public entity, population < 50,000, or any special district government | April 26, 2027 | **April 26, 2028** |

Always confirm the operative date for a specific entity at ada.gov before
relying on it.

## How to use this in a project

1. Identify the **audience/client** (row above).
2. Record the **legal minimum** for that row.
3. Record the **internal engineering standard** (default WCAG 2.2 AA).
4. If the two differ, document **both** in `ACCESSIBILITY_STANDARD.md` — never
   collapse them into one number, and never describe meeting the internal
   standard as legal compliance or immunity.
5. Flag anything in the "Legal review?" column for Jesse to route to counsel.

## What we never claim

- Not "100% ADA compliant," "certified ADA compliant," or "legally protected
  from accessibility claims."
- Not that passing automated tools = compliance or accessibility.
- Not that meeting WCAG 2.2 AA grants permanent or guaranteed legal compliance.
See `ACCESSIBILITY_STANDARD.md` → "Claims we never make."
