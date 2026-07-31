import { describe, expect, it } from 'vitest';
import { COMPLIANCE_OBLIGATION_TYPES } from '@home-folder/shared';
import { DUE_SOON_DAYS, advanceNextDue, obligationStatus } from '../lib/compliance';
import { COMPLIANCE_TEMPLATES } from '../lib/complianceTemplates';

describe('advanceNextDue', () => {
  it('adds months to the completion date', () => {
    expect(advanceNextDue('2026-03-15', 1)).toBe('2026-04-15');
    expect(advanceNextDue('2026-01-05', 6)).toBe('2026-07-05');
  });

  it('rolls over year boundaries', () => {
    expect(advanceNextDue('2026-11-15', 3)).toBe('2027-02-15');
    expect(advanceNextDue('2026-07-30', 12)).toBe('2027-07-30');
    expect(advanceNextDue('2026-07-30', 24)).toBe('2028-07-30');
  });

  it('clamps month-end: Jan 31 + 1 month = Feb 28 in a common year', () => {
    expect(advanceNextDue('2026-01-31', 1)).toBe('2026-02-28');
    expect(advanceNextDue('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(advanceNextDue('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('handles a Feb 29 completion advancing into a common year', () => {
    expect(advanceNextDue('2028-02-29', 12)).toBe('2029-02-28');
  });

  it('rejects an unparseable completion date', () => {
    expect(() => advanceNextDue('not-a-date', 1)).toThrow();
  });
});

describe('obligationStatus', () => {
  const today = '2026-07-30';

  it('flags yesterday as overdue', () => {
    expect(obligationStatus('2026-07-29', today)).toBe('overdue');
  });

  it('flags today (0 days out) as due soon', () => {
    expect(obligationStatus('2026-07-30', today)).toBe('due_soon');
  });

  it('flags exactly 60 days out as due soon (inclusive boundary)', () => {
    // 2026-07-30 + 60 days = 2026-09-28.
    expect(obligationStatus('2026-09-28', today)).toBe('due_soon');
    expect(DUE_SOON_DAYS).toBe(60);
  });

  it('flags 61 days out as scheduled', () => {
    expect(obligationStatus('2026-09-29', today)).toBe('scheduled');
  });

  it('returns no_date for a missing due date', () => {
    expect(obligationStatus(null, today)).toBe('no_date');
  });

  it('returns no_date for an unparseable due date', () => {
    expect(obligationStatus('someday', today)).toBe('no_date');
  });
});

describe('COMPLIANCE_TEMPLATES catalog', () => {
  // Every reference must live on one of these official government domains
  // (exact host or a subdomain). Blogs and commercial sites are not allowed.
  const OFFICIAL_DOMAINS = [
    'nyc.gov',
    'seattle.gov',
    'phila.gov',
    'mass.gov',
    'leginfo.legislature.ca.gov',
    'usfa.fema.gov',
    'energy.gov',
    'hud.gov'
  ];

  it('has unique kebab-case ids', () => {
    const ids = COMPLIANCE_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('only links to https official government sources', () => {
    for (const template of COMPLIANCE_TEMPLATES) {
      const url = new URL(template.reference_url);
      expect(url.protocol, `${template.id} must use https`).toBe('https:');

      const onOfficialDomain = OFFICIAL_DOMAINS.some(
        (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
      expect(onOfficialDomain, `${template.id} links to unexpected host ${url.hostname}`).toBe(true);
    }
  });

  it('uses valid obligation types and sane numeric fields', () => {
    for (const template of COMPLIANCE_TEMPLATES) {
      expect(
        COMPLIANCE_OBLIGATION_TYPES.includes(template.obligation_type),
        `${template.id} has invalid obligation_type ${template.obligation_type}`
      ).toBe(true);

      if (template.frequency_months !== null) {
        expect(Number.isInteger(template.frequency_months)).toBe(true);
        expect(template.frequency_months).toBeGreaterThanOrEqual(1);
        expect(template.frequency_months).toBeLessThanOrEqual(240);
      }

      if (template.retention_years !== null) {
        expect(Number.isInteger(template.retention_years)).toBe(true);
        expect(template.retention_years).toBeGreaterThanOrEqual(0);
        expect(template.retention_years).toBeLessThanOrEqual(100);
      }
    }
  });

  it('carries a title, authority, jurisdiction, and plain-language notes on every entry', () => {
    for (const template of COMPLIANCE_TEMPLATES) {
      expect(template.title.trim().length).toBeGreaterThan(0);
      expect(template.authority.trim().length).toBeGreaterThan(0);
      expect(template.jurisdiction.trim().length).toBeGreaterThan(0);
      expect(template.notes.trim().length).toBeGreaterThan(20);
    }
  });

  it('covers the seeded jurisdictions including a General set', () => {
    const jurisdictions = new Set(COMPLIANCE_TEMPLATES.map((template) => template.jurisdiction));
    for (const expected of ['New York City', 'Seattle, WA', 'Philadelphia, PA', 'Massachusetts', 'California', 'General']) {
      expect(jurisdictions.has(expected), `missing jurisdiction ${expected}`).toBe(true);
    }
  });
});
