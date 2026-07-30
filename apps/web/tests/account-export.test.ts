import { describe, expect, it } from 'vitest';
import { buildCsvSheets, buildReadme, rowsToCsv, type AccountExport } from '../lib/accountExport';

function makeExport(overrides: Partial<AccountExport> = {}): AccountExport {
  return {
    format: 'our-home-folder-export',
    formatVersion: 1,
    generatedAt: '2026-07-30T12:00:00.000Z',
    notice: 'complete copy',
    property: { nickname: 'The Bransons' },
    counts: { rooms: 2, utilities: 1 },
    floors: [],
    rooms: [
      { name: 'Kitchen', room_type: 'kitchen', floor_name: 'Main Floor', notes: null },
      { name: 'Basement', room_type: 'basement', floor_name: 'Lower', notes: 'damp in spring' }
    ],
    utilities: [
      {
        name: 'Main water shut-off',
        utility_type: 'main_water_shutoff',
        room_id: 'room-1',
        location_notes: 'behind the furnace',
        emergency_notes: null,
        created_at: '2026-01-01'
      }
    ],
    assets: [],
    reminders: [],
    repairs: [],
    serviceRecords: [],
    issues: [],
    trendFlags: [],
    documents: [],
    receipts: [],
    automation: { devices: [], hubs: [], networks: [], routines: [] },
    ...overrides
  };
}

describe('CSV serialisation', () => {
  it('escapes commas, quotes and newlines so a spreadsheet reads it correctly', () => {
    const csv = rowsToCsv(
      [
        { name: 'Shed, rear', notes: 'He said "watch the step"' },
        { name: 'Loft', notes: 'low beam\nmind your head' }
      ],
      ['name', 'notes']
    );

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('name,notes');
    expect(lines[1]).toBe('"Shed, rear","He said ""watch the step"""');
    // A newline inside a quoted field is legal CSV and must stay quoted.
    expect(csv).toContain('"low beam\nmind your head"');
  });

  it('writes empty cells for null and undefined rather than the words', () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: 0, d: false }], ['a', 'b', 'c', 'd']);
    expect(csv.split('\r\n')[1]).toBe(',,0,false');
  });

  it('keeps column order stable regardless of key order in the row', () => {
    const csv = rowsToCsv([{ b: 'second', a: 'first' }], ['a', 'b']);
    expect(csv.split('\r\n')[1]).toBe('first,second');
  });
});

describe('CSV sheets', () => {
  it('produces one sheet per populated section and skips empty ones', () => {
    const sheets = buildCsvSheets(makeExport());
    const names = sheets.map((sheet) => sheet.name);

    expect(names).toContain('rooms');
    expect(names).toContain('utilities');
    // Nothing recorded, so no empty file to confuse the user.
    expect(names).not.toContain('assets');
    expect(names).not.toContain('receipts');
  });

  it('carries the real values through to the sheet', () => {
    const sheets = buildCsvSheets(makeExport());
    const rooms = sheets.find((sheet) => sheet.name === 'rooms');

    expect(rooms?.rowCount).toBe(2);
    expect(rooms?.contents).toContain('Kitchen');
    expect(rooms?.contents).toContain('damp in spring');
  });
});

describe('README', () => {
  it('states plainly that uploaded files are not included', () => {
    const readme = buildReadme(makeExport());

    // The Centriq lesson: an export that silently omits your files is the
    // failure mode, so this has to be impossible to miss.
    expect(readme).toContain('YOUR UPLOADED FILES ARE NOT IN THIS EXPORT');
    expect(readme).toContain('Download anything you need from Documents');
  });

  it('warns that the export is unredacted, unlike the shared documents', () => {
    const readme = buildReadme(makeExport());
    expect(readme).toContain('PLEASE STORE THIS SAFELY');
    expect(readme).toMatch(/not redacted|does not/i);
  });

  it('lists what was actually recorded, and copes with an empty record', () => {
    expect(buildReadme(makeExport())).toContain('rooms');

    const empty = buildReadme(makeExport({ counts: { rooms: 0, utilities: 0 } }));
    expect(empty).toContain('(nothing recorded yet)');
  });
});
