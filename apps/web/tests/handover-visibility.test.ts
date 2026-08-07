import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisibilityContext } from '@home-folder/shared';
import type { AssetRow } from '../lib/assets';
import type { DocumentRow } from '../lib/documents';

// Regression test for the handover privacy leak: the report builder pulled
// every document for the property, so a document marked only for the personal
// archive was listed by title, type and date in the family and buyer packs —
// the two packs handed to people outside the household. The report type is the
// visibility context, so each pack must show only the entries marked for it.

function makeDocument(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'document-1',
    property_id: 'property-1',
    room_id: null,
    utility_id: null,
    asset_id: null,
    reminder_id: null,
    repair_id: null,
    service_record_id: null,
    issue_id: null,
    trend_flag_id: null,
    automation_device_id: null,
    document_type: 'photo',
    title: 'Photo',
    description: null,
    file_name: 'photo.jpg',
    file_path: 'property-1/photo.jpg',
    thumbnail_path: null,
    bucket_name: 'home-documents',
    mime_type: 'image/jpeg',
    file_size_bytes: null,
    visibility: 'family',
    visibility_contexts: ['family'],
    source: 'manual_upload',
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function makeAsset(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: 'asset-1',
    property_id: 'property-1',
    room_id: null,
    asset_type: 'appliance',
    name: 'Refrigerator',
    brand: null,
    model: null,
    serial_number: null,
    purchase_date: null,
    purchase_price: null,
    retailer: null,
    warranty_length_months: null,
    warranty_expires_at: null,
    manual_url: null,
    support_url: null,
    notes: null,
    visibility: 'family',
    visibility_contexts: ['family'],
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function documentWithContexts(id: string, contexts: VisibilityContext[]) {
  return makeDocument({ id, visibility_contexts: contexts });
}

function assetWithContexts(id: string, contexts: VisibilityContext[]) {
  return makeAsset({ id, visibility_contexts: contexts });
}

// What the property holds, as the loaders would return it. Each test reads
// these through the real loadHandoverReport, so the filter has to be wired in
// rather than merely exported.
let storedDocuments: DocumentRow[] = [];
let storedAssets: AssetRow[] = [];

vi.mock('../lib/auth', () => ({
  isSupabaseConfigured: () => true,
  getCurrentUser: async () => ({ id: 'user-1' }),
  getCurrentUserUncached: async () => ({ id: 'user-1' })
}));

vi.mock('../lib/properties', () => ({
  getPrimaryPropertyForUser: async () => ({
    id: 'property-1',
    household_id: 'household-1',
    owner_user_id: 'user-1',
    nickname: 'The house',
    property_type: 'single_family',
    created_at: '2026-01-01T00:00:00.000Z',
    parent_property_id: null,
    unit_label: null
  })
}));

vi.mock('../lib/documents', () => ({
  getDemoDocuments: () => [],
  getDocumentsForProperty: async () => storedDocuments
}));

vi.mock('../lib/assets', () => ({
  getDemoAssets: () => [],
  getAssetsForProperty: async () => storedAssets
}));

vi.mock('../lib/rooms', () => ({
  getFloorsForProperty: async () => [],
  getRoomsForProperty: async () => []
}));

// The insurance report assembles its claim inventory from these two regardless
// of which sections are switched on, so they load for that report type.
vi.mock('../lib/receipts', () => ({
  getDemoReceipts: () => [],
  getReceiptsForProperty: async () => []
}));

vi.mock('../lib/serviceRecords', () => ({
  getDemoServiceRecords: () => [],
  getServiceRecordsForProperty: async () => []
}));

const { filterEntriesForReportType, loadHandoverReport, HANDOVER_REPORT_TYPES } = await import(
  '../lib/handover'
);

describe('filterEntriesForReportType', () => {
  const privateDocument = documentWithContexts('doc-private', ['personal_archive']);
  const familyDocument = documentWithContexts('doc-family', ['family']);
  const buyerDocument = documentWithContexts('doc-buyer', ['buyer']);
  const sharedDocument = documentWithContexts('doc-shared', ['family', 'buyer', 'insurance']);
  const allDocuments = [privateDocument, familyDocument, buyerDocument, sharedDocument];

  it('keeps personal_archive-only documents out of the family pack', () => {
    const visible = filterEntriesForReportType(allDocuments, 'family');

    expect(visible.map((document) => document.id)).toEqual(['doc-family', 'doc-shared']);
  });

  it('keeps personal_archive-only documents out of the buyer pack', () => {
    const visible = filterEntriesForReportType(allDocuments, 'buyer');

    expect(visible.map((document) => document.id)).toEqual(['doc-buyer', 'doc-shared']);
  });

  it('shows only insurance-context documents in the insurance pack', () => {
    const visible = filterEntriesForReportType(allDocuments, 'insurance');

    expect(visible.map((document) => document.id)).toEqual(['doc-shared']);
  });

  it('holds nothing back from the keeper’s own personal archive report', () => {
    const visible = filterEntriesForReportType(allDocuments, 'personal_archive');

    expect(visible).toEqual(allDocuments);
  });

  it('treats an entry carrying no contexts as personal_archive-only', () => {
    // normalizeVisibilityContexts defaults an unmarked entry to the personal
    // archive, so the safe reading is the private one.
    const unmarked = documentWithContexts('doc-unmarked', []);

    expect(filterEntriesForReportType([unmarked], 'family')).toEqual([]);
    expect(filterEntriesForReportType([unmarked], 'buyer')).toEqual([]);
    expect(filterEntriesForReportType([unmarked], 'personal_archive')).toEqual([unmarked]);
  });

  it('never leaks a personal_archive-only entry into any shared pack', () => {
    for (const reportType of HANDOVER_REPORT_TYPES) {
      if (reportType === 'personal_archive') {
        continue;
      }

      expect(filterEntriesForReportType([privateDocument], reportType)).toEqual([]);
    }
  });

  it('filters assets by the same report context', () => {
    const assets = [
      assetWithContexts('asset-private', ['personal_archive']),
      assetWithContexts('asset-family', ['family']),
      assetWithContexts('asset-insurance', ['insurance'])
    ];

    expect(filterEntriesForReportType(assets, 'family').map((asset) => asset.id)).toEqual([
      'asset-family'
    ]);
    expect(filterEntriesForReportType(assets, 'insurance').map((asset) => asset.id)).toEqual([
      'asset-insurance'
    ]);
    expect(filterEntriesForReportType(assets, 'personal_archive')).toEqual(assets);
  });
});

describe('loadHandoverReport visibility', () => {
  const sections = ['assets', 'documents_summary'] as const;

  beforeEach(() => {
    storedDocuments = [
      documentWithContexts('doc-private', ['personal_archive']),
      documentWithContexts('doc-family', ['family']),
      documentWithContexts('doc-buyer', ['buyer'])
    ];
    storedAssets = [
      assetWithContexts('asset-private', ['personal_archive']),
      assetWithContexts('asset-family', ['family']),
      assetWithContexts('asset-buyer', ['buyer'])
    ];
  });

  it('leaves the private document and asset out of the family pack', async () => {
    const report = await loadHandoverReport({ reportType: 'family', sections: [...sections] });

    // An empty list because a loader threw would pass a "not present" check on
    // its own, so confirm the loads actually succeeded first.
    expect(report.sectionErrors).toEqual([]);
    expect(report.documents.map((document) => document.id)).toEqual(['doc-family']);
    expect(report.assets.map((asset) => asset.id)).toEqual(['asset-family']);
  });

  it('leaves the private document and asset out of the buyer pack', async () => {
    const report = await loadHandoverReport({ reportType: 'buyer', sections: [...sections] });

    expect(report.sectionErrors).toEqual([]);
    expect(report.documents.map((document) => document.id)).toEqual(['doc-buyer']);
    expect(report.assets.map((asset) => asset.id)).toEqual(['asset-buyer']);
  });

  it('gives the keeper their whole record in the personal archive report', async () => {
    const report = await loadHandoverReport({
      reportType: 'personal_archive',
      sections: [...sections]
    });

    expect(report.sectionErrors).toEqual([]);
    expect(report.documents).toHaveLength(3);
    expect(report.assets).toHaveLength(3);
  });

  it('builds the insurance claim inventory from insurance-context entries only', async () => {
    storedAssets = [
      assetWithContexts('asset-private', ['personal_archive']),
      assetWithContexts('asset-insured', ['insurance'])
    ];
    storedDocuments = [documentWithContexts('doc-private', ['personal_archive'])];

    const report = await loadHandoverReport({ reportType: 'insurance', sections: [...sections] });

    expect(report.sectionErrors).toEqual([]);
    expect(report.claimInventory?.items.map((item) => item.assetId)).toEqual(['asset-insured']);
    expect(report.claimInventory?.totals.itemCount).toBe(1);
    expect(report.documents).toEqual([]);
  });
});
