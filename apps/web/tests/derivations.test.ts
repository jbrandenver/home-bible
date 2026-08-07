import { describe, expect, it } from 'vitest';
import { DOCUMENT_TYPES, ISSUE_STATUSES, REPAIR_STATUSES, TENANCY_STATUSES } from '@home-folder/shared';
import {
  documentTitleFromFileName,
  draftAssetNameFrom,
  documentTypeFromFile,
  impliedIssueStatus,
  impliedRepairStatus,
  nextDueFrom,
  repairStatusNeedsCorrection,
  tenancyStatusForDates
} from '../lib/derivations';

describe('documentTitleFromFileName', () => {
  it('drops the extension', () => {
    expect(documentTitleFromFileName('boiler manual.pdf')).toBe('Boiler manual');
  });

  it('turns filesystem separators into spaces', () => {
    expect(documentTitleFromFileName('boiler_manual_2019.pdf')).toBe('Boiler manual 2019');
    expect(documentTitleFromFileName('boiler-manual.pdf')).toBe('Boiler manual');
  });

  // "AC-3000" is a model number, not two words.
  it('keeps hyphens that are not between words', () => {
    expect(documentTitleFromFileName('AC-3000 warranty.pdf')).toBe('AC-3000 warranty');
  });

  it('strips a directory path', () => {
    expect(documentTitleFromFileName('/Users/me/Documents/deed.pdf')).toBe('Deed');
    expect(documentTitleFromFileName('C:\\docs\\deed.pdf')).toBe('Deed');
  });

  it('leaves deliberate casing alone', () => {
    expect(documentTitleFromFileName('HVAC service report.pdf')).toBe('HVAC service report');
  });

  // Migration 007's backfill is the floor: never return an empty title.
  it('falls back the way the database does', () => {
    for (const junk of ['', '   ', '.pdf', null, undefined, 42]) {
      expect(documentTitleFromFileName(junk)).toBe('Untitled document');
    }
  });
});

describe('documentTypeFromFile', () => {
  it('recognises the common kinds by name', () => {
    expect(documentTypeFromFile('boiler manual.pdf')).toBe('manual');
    expect(documentTypeFromFile('fridge warranty.pdf')).toBe('warranty');
    expect(documentTypeFromFile('plumber invoice.pdf')).toBe('invoice');
    expect(documentTypeFromFile('roof quote.pdf')).toBe('quote');
    expect(documentTypeFromFile('home insurance policy.pdf')).toBe('insurance');
    expect(documentTypeFromFile('building permit.pdf')).toBe('permit');
    expect(documentTypeFromFile('house deed.pdf')).toBe('property_document');
    expect(documentTypeFromFile('gas safe certificate.pdf')).toBe('compliance_certificate');
    expect(documentTypeFromFile('annual inspection.pdf')).toBe('inspection_report');
  });

  it('prefers the more specific rule', () => {
    // Both "inspection" and "report" appear; the inspection wins.
    expect(documentTypeFromFile('inspection service report.pdf')).toBe('inspection_report');
  });

  // A file called "boiler-manual.jpg" is a manual that happens to be a photo.
  it('lets the name beat the mime type', () => {
    expect(documentTypeFromFile('boiler-manual.jpg', 'image/jpeg')).toBe('manual');
  });

  it('falls back to photo for an unnamed image', () => {
    expect(documentTypeFromFile('IMG_4821.jpg', 'image/jpeg')).toBe('photo');
  });

  // A confidently wrong default is worse than an empty field: nobody re-reads
  // something that already looks filled in.
  it('returns null rather than guessing', () => {
    expect(documentTypeFromFile('scan001.pdf', 'application/pdf')).toBeNull();
    expect(documentTypeFromFile(null)).toBeNull();
  });

  it('only ever returns a valid document type', () => {
    const names = ['manual.pdf', 'warranty.pdf', 'deed.pdf', 'x.jpg', 'nothing.bin'];
    for (const name of names) {
      const result = documentTypeFromFile(name, 'image/jpeg');
      if (result !== null) {
        expect(DOCUMENT_TYPES).toContain(result);
      }
    }
  });
});

describe('draftAssetNameFrom', () => {
  it('joins what the plate actually read', () => {
    expect(draftAssetNameFrom('Samsung', 'RF28R7001SR')).toBe('Samsung RF28R7001SR');
  });

  it('uses whichever half it got', () => {
    expect(draftAssetNameFrom('Samsung', null)).toBe('Samsung');
    expect(draftAssetNameFrom(null, 'RF28R7001SR')).toBe('RF28R7001SR');
  });

  // Null, not an empty string: name is required, so the caller has to ask
  // rather than save something blank.
  it('returns null when the plate yielded nothing', () => {
    expect(draftAssetNameFrom(null, null)).toBeNull();
    expect(draftAssetNameFrom('  ', '')).toBeNull();
    expect(draftAssetNameFrom(42, {})).toBeNull();
  });

  it('trims', () => {
    expect(draftAssetNameFrom('  Samsung ', ' RF28 ')).toBe('Samsung RF28');
  });
});

describe('status implied by dates', () => {
  it('reads a completed date as completed', () => {
    expect(impliedRepairStatus('2026-03-01')).toBe('completed');
  });

  it('reads a scheduled date as scheduled', () => {
    expect(impliedRepairStatus(null, '2026-03-01')).toBe('scheduled');
  });

  it('prefers completed over scheduled', () => {
    expect(impliedRepairStatus('2026-03-05', '2026-03-01')).toBe('completed');
  });

  it('implies nothing without dates', () => {
    expect(impliedRepairStatus(null)).toBeNull();
    expect(impliedRepairStatus('   ')).toBeNull();
  });

  it('reads a resolved date as resolved', () => {
    expect(impliedIssueStatus('2026-03-01')).toBe('resolved');
    expect(impliedIssueStatus(null)).toBeNull();
  });

  it('returns statuses that exist in the shared enums', () => {
    expect(REPAIR_STATUSES).toContain(impliedRepairStatus('2026-03-01'));
    expect(ISSUE_STATUSES).toContain(impliedIssueStatus('2026-03-01'));
  });
});

describe('repairStatusNeedsCorrection', () => {
  it('flags a finished job still marked open', () => {
    expect(repairStatusNeedsCorrection('open', '2026-03-01')).toBe(true);
  });

  it('leaves a cancelled job alone', () => {
    expect(repairStatusNeedsCorrection('cancelled', '2026-03-01')).toBe(false);
  });

  // Marking something done before filling in the date is reasonable; the rule
  // must not fight it.
  it('does not fire in the other direction', () => {
    expect(repairStatusNeedsCorrection('completed', null)).toBe(false);
  });
});

describe('nextDueFrom', () => {
  it('adds the interval', () => {
    expect(nextDueFrom('2026-01-15', 12)).toBe('2027-01-15');
    expect(nextDueFrom('2026-01-15', 6)).toBe('2026-07-15');
  });

  // 31 January plus one month is 28 February, not 3 March.
  it('clamps rather than overflowing a short month', () => {
    expect(nextDueFrom('2026-01-31', 1)).toBe('2026-02-28');
    expect(nextDueFrom('2024-01-31', 1)).toBe('2024-02-29');
    expect(nextDueFrom('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('returns null when it cannot tell', () => {
    expect(nextDueFrom(null, 12)).toBeNull();
    expect(nextDueFrom('2026-01-15', null)).toBeNull();
    expect(nextDueFrom('2026-01-15', 0)).toBeNull();
    expect(nextDueFrom('not a date', 12)).toBeNull();
  });
});

describe('tenancyStatusForDates', () => {
  const today = new Date(2026, 5, 15);

  it('is upcoming before it starts', () => {
    expect(tenancyStatusForDates('2026-09-01', null, today)).toBe('upcoming');
  });

  it('is active once it has started', () => {
    expect(tenancyStatusForDates('2026-01-01', '2027-01-01', today)).toBe('active');
  });

  it('is ended after the end date', () => {
    expect(tenancyStatusForDates('2025-01-01', '2026-01-01', today)).toBe('ended');
  });

  it('is active on the first and last day', () => {
    expect(tenancyStatusForDates('2026-06-15', null, today)).toBe('active');
    expect(tenancyStatusForDates('2026-01-01', '2026-06-15', today)).toBe('active');
  });

  it('defaults to active with no dates at all', () => {
    expect(tenancyStatusForDates(null, null, today)).toBe('active');
  });

  it('only returns statuses that exist in the shared enum', () => {
    for (const [start, end] of [
      ['2026-09-01', null],
      ['2026-01-01', '2027-01-01'],
      ['2025-01-01', '2026-01-01'],
      [null, null]
    ] as const) {
      expect(TENANCY_STATUSES).toContain(tenancyStatusForDates(start, end, today));
    }
  });
});
