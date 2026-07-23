# Accessibility Audit History

Date-stamped record of formal accessibility audits and major remediations.
**Preserve history — never overwrite a previous audit.**

## Naming

```
docs/accessibility/audits/YYYY-MM-DD-accessibility-audit.md
docs/accessibility/audits/YYYY-MM-DD-<area>-remediation.md
```

Example: `docs/accessibility/audits/2026-07-22-accessibility-audit.md`

## How to create one

1. Copy `../ACCESSIBILITY_AUDIT_TEMPLATE.md` to a new dated file here.
2. Fill the executive summary, findings table (each mapped to a WCAG criterion
   and severity), and the test-coverage section.
3. Commit it. Future audits are new files, not edits to this one.

## For major remediations, record

- Issue and WCAG criterion
- Before behavior
- Fix
- Testing performed (keyboard / screen reader / automated / device)
- Remaining limitations

This trail demonstrates ongoing diligence and lets us track regressions over
time. It is a record of work performed on given dates — not a certification or a
guarantee of legal compliance.
