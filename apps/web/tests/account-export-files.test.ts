import { describe, expect, it } from 'vitest';
import {
  buildExportFilePath,
  buildMissingManifest,
  buildReadme,
  exceedsExportSizeWarning,
  EXPORT_SIZE_WARNING_BYTES,
  totalFileSizeBytes,
  type AccountExport
} from '../lib/accountExport';

function makeExport(overrides: Partial<AccountExport> = {}): AccountExport {
  return {
    format: 'our-home-folder-export',
    formatVersion: 1,
    generatedAt: '2026-07-30T12:00:00.000Z',
    notice: 'complete copy',
    property: { nickname: 'The Bransons' },
    counts: { rooms: 1 },
    floors: [],
    rooms: [{ name: 'Kitchen', room_type: 'kitchen', floor_name: 'Main', notes: null }],
    utilities: [],
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

describe('buildExportFilePath', () => {
  it('places the file under a slug of the property nickname and keeps the extension', () => {
    const used = new Set<string>();
    expect(buildExportFilePath('Maple House', 'Boiler manual', 'boiler-manual.pdf', used)).toBe(
      'files/maple-house/Boiler manual.pdf'
    );
  });

  it('dedupes collisions with a numeric suffix before the extension', () => {
    const used = new Set<string>();
    expect(buildExportFilePath('Maple House', 'Receipt', 'a.jpg', used)).toBe('files/maple-house/Receipt.jpg');
    expect(buildExportFilePath('Maple House', 'Receipt', 'b.jpg', used)).toBe('files/maple-house/Receipt-2.jpg');
    expect(buildExportFilePath('Maple House', 'Receipt', 'c.jpg', used)).toBe('files/maple-house/Receipt-3.jpg');
  });

  it('does not double the extension when the title already carries it', () => {
    const used = new Set<string>();
    expect(buildExportFilePath('Maple House', 'invoice.pdf', 'invoice.pdf', used)).toBe(
      'files/maple-house/invoice.pdf'
    );
  });

  it('strips path-breaking characters from the document title', () => {
    const used = new Set<string>();
    const path = buildExportFilePath('Maple House', 'HVAC: before/after "quote"', 'quote.pdf', used);
    expect(path.startsWith('files/maple-house/')).toBe(true);
    // Only the two structural slashes (files/<slug>/) may remain.
    expect(path.split('/').length).toBe(3);
    expect(path).not.toContain(':');
    expect(path).not.toContain('"');
    expect(path.endsWith('.pdf')).toBe(true);
  });

  it('falls back to the stored file name when the title is name-unsafe (secret phrasing)', () => {
    const used = new Set<string>();
    // safeFileName redacts titles matching secret phrasings ("garage code").
    expect(buildExportFilePath('Maple House', 'Garage code list', 'scan-0042.png', used)).toBe(
      'files/maple-house/scan-0042.png'
    );
  });

  it('falls back to the stored file name when the title is URL-shaped', () => {
    const used = new Set<string>();
    expect(buildExportFilePath('Maple House', 'https://example.com/manual', 'manual.pdf', used)).toBe(
      'files/maple-house/manual.pdf'
    );
  });

  it('falls back to "document" when neither title nor file name is usable', () => {
    const used = new Set<string>();
    expect(buildExportFilePath('Maple House', 'Wifi password sheet', 'wifi password.pdf', used)).toBe(
      'files/maple-house/document.pdf'
    );
  });

  it('uses a "property" folder when the nickname is missing or unslugable', () => {
    expect(buildExportFilePath(null, 'Deed', 'deed.pdf', new Set())).toBe('files/property/Deed.pdf');
    expect(buildExportFilePath('***', 'Deed', 'deed.pdf', new Set())).toBe('files/property/Deed.pdf');
  });
});

describe('buildMissingManifest', () => {
  it('lists each missing file with its intended path, title, and reason', () => {
    const manifest = buildMissingManifest([
      { path: 'files/maple-house/Boiler manual.pdf', title: 'Boiler manual', reason: 'download failed (HTTP 404)' }
    ]);

    expect(manifest).toContain('FILES THAT COULD NOT BE INCLUDED');
    expect(manifest).toContain('files/maple-house/Boiler manual.pdf');
    expect(manifest).toContain('title:  Boiler manual');
    expect(manifest).toContain('reason: download failed (HTTP 404)');
    // The manifest promises nothing was deleted — honesty copy is load-bearing.
    expect(manifest).toContain('Nothing was deleted');
  });
});

describe('buildReadme file copy', () => {
  it('still says files are NOT included for the plain (no-files) export', () => {
    const readme = buildReadme(makeExport());
    expect(readme).toContain('YOUR UPLOADED FILES ARE NOT IN THIS EXPORT');
    expect(readme).not.toContain('files/                    Your uploaded files');
  });

  it('describes the files/ folder and the MISSING.txt convention for the archive', () => {
    const readme = buildReadme(makeExport(), {
      filesIncluded: true,
      includedFileCount: 3,
      missingFileCount: 0
    });

    expect(readme).toContain('files/                    Your uploaded files, one folder per property.');
    expect(readme).toContain('YOUR UPLOADED FILES');
    expect(readme).toContain('3 files in this archive');
    expect(readme).toContain('files/MISSING.txt');
    expect(readme).not.toContain('YOUR UPLOADED FILES ARE NOT IN THIS EXPORT');
  });

  it('calls out the number of missing files when some could not be fetched', () => {
    const readme = buildReadme(makeExport(), {
      filesIncluded: true,
      includedFileCount: 2,
      missingFileCount: 1
    });

    expect(readme).toContain('NOTE: 1 file could not be fetched this time — see files/MISSING.txt.');
  });
});

describe('export size guard', () => {
  it('warns only above the 200 MB threshold', () => {
    expect(EXPORT_SIZE_WARNING_BYTES).toBe(200 * 1024 * 1024);
    expect(exceedsExportSizeWarning(EXPORT_SIZE_WARNING_BYTES)).toBe(false);
    expect(exceedsExportSizeWarning(EXPORT_SIZE_WARNING_BYTES + 1)).toBe(true);
    expect(exceedsExportSizeWarning(0)).toBe(false);
  });

  it('sums file sizes and treats unknown sizes as zero', () => {
    expect(
      totalFileSizeBytes([{ fileSizeBytes: 100 }, { fileSizeBytes: null }, { fileSizeBytes: 250 }])
    ).toBe(350);
    expect(totalFileSizeBytes([])).toBe(0);
  });
});
