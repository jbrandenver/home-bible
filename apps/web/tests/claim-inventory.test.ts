import { describe, expect, it } from 'vitest';
import { buildClaimInventory } from '../lib/handover';
import type { AssetRow } from '../lib/assets';
import type { DocumentRow } from '../lib/documents';
import type { ReceiptRow } from '../lib/receipts';
import type { ServiceRecordRow } from '../lib/serviceRecords';

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

function makeReceipt(overrides: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    id: 'receipt-1',
    property_id: 'property-1',
    document_id: null,
    room_id: null,
    utility_id: null,
    asset_id: null,
    repair_id: null,
    service_record_id: null,
    vendor_name: null,
    purchase_date: null,
    total_amount: null,
    tax_amount: null,
    currency: 'USD',
    payment_method: null,
    category: 'appliance',
    description: null,
    notes: null,
    approval_status: 'approved',
    source: 'manual_entry',
    created_by: null,
    approved_by: null,
    approved_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

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

function makeServiceRecord(overrides: Partial<ServiceRecordRow> = {}): ServiceRecordRow {
  return {
    id: 'service-1',
    property_id: 'property-1',
    room_id: null,
    asset_id: null,
    utility_id: null,
    service_title: 'Furnace tune-up',
    service_type: 'maintenance',
    service_date: '2026-03-01',
    provider_name: null,
    provider_phone: null,
    provider_email: null,
    cost: null,
    summary: null,
    notes: null,
    next_service_date: null,
    title: 'Furnace tune-up',
    description: null,
    vendor_name: null,
    vendor_phone: null,
    vendor_email: null,
    follow_up_needed: false,
    follow_up_date: null,
    visibility: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

describe('buildClaimInventory', () => {
  describe('receipt-to-asset linking', () => {
    it('links approved receipts to assets by receipt.asset_id', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1' }), makeAsset({ id: 'asset-2', name: 'Washer' })],
        [
          makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: 1200 }),
          makeReceipt({ id: 'r2', asset_id: 'asset-1', total_amount: 80 }),
          makeReceipt({ id: 'r3', asset_id: 'asset-2', total_amount: 640 }),
          makeReceipt({ id: 'r4', asset_id: null, total_amount: 999 })
        ],
        [],
        []
      );

      const [first, second] = inventory.items;
      expect(first.receiptCount).toBe(2);
      expect(first.receiptAmount).toBe(1280);
      expect(second.receiptCount).toBe(1);
      expect(second.receiptAmount).toBe(640);
    });

    it('ignores receipts that are not approved', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1' })],
        [
          makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: 500, approval_status: 'draft' }),
          makeReceipt({ id: 'r2', asset_id: 'asset-1', total_amount: 300, approval_status: 'rejected' }),
          makeReceipt({ id: 'r3', asset_id: 'asset-1', total_amount: 200, approval_status: 'needs_review' })
        ],
        [],
        []
      );

      expect(inventory.items[0].receiptCount).toBe(0);
      expect(inventory.items[0].receiptAmount).toBeNull();
      expect(inventory.items[0].documentedValue).toBeNull();
    });

    it('counts linked receipts without amounts as evidence but not value', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1' })],
        [makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: null })],
        [],
        []
      );

      expect(inventory.items[0].receiptCount).toBe(1);
      expect(inventory.items[0].receiptAmount).toBeNull();
      expect(inventory.items[0].documentedValue).toBeNull();
      expect(inventory.totals.itemsWithoutValue).toBe(1);
    });
  });

  describe('documented-value totaling', () => {
    it('prefers purchase_price and never adds the receipt amount on top', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1', purchase_price: 1500 })],
        [makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: 1450 })],
        [],
        []
      );

      const item = inventory.items[0];
      expect(item.documentedValue).toBe(1500);
      expect(item.valueSource).toBe('purchase_price');
      // The linked receipt is still reported as evidence, but its amount is
      // never double-counted into the documented value.
      expect(item.receiptAmount).toBe(1450);
      expect(inventory.totals.documentedValueTotal).toBe(1500);
    });

    it('falls back to the linked receipt amount when purchase_price is missing', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1', purchase_price: null })],
        [makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: 725.5 })],
        [],
        []
      );

      const item = inventory.items[0];
      expect(item.documentedValue).toBe(725.5);
      expect(item.valueSource).toBe('receipt');
      expect(inventory.totals.documentedValueTotal).toBe(725.5);
    });

    it('totals across mixed value sources without inventing values', () => {
      const inventory = buildClaimInventory(
        [
          makeAsset({ id: 'asset-1', purchase_price: 1000 }),
          makeAsset({ id: 'asset-2', purchase_price: null }),
          makeAsset({ id: 'asset-3', purchase_price: null })
        ],
        [makeReceipt({ id: 'r1', asset_id: 'asset-2', total_amount: 250 })],
        [],
        []
      );

      expect(inventory.totals.itemCount).toBe(3);
      expect(inventory.totals.documentedValueTotal).toBe(1250);
      expect(inventory.totals.itemsWithValue).toBe(2);
      expect(inventory.totals.itemsWithoutValue).toBe(1);
      expect(inventory.items[2].documentedValue).toBeNull();
      expect(inventory.items[2].valueSource).toBeNull();
    });

    it('treats a zero purchase price as a documented value, not a missing one', () => {
      const inventory = buildClaimInventory([makeAsset({ id: 'asset-1', purchase_price: 0 })], [], [], []);

      expect(inventory.items[0].documentedValue).toBe(0);
      expect(inventory.items[0].valueSource).toBe('purchase_price');
      expect(inventory.totals.itemsWithValue).toBe(1);
      expect(inventory.totals.itemsWithoutValue).toBe(0);
    });
  });

  describe('items-without-value counting', () => {
    it('counts every asset with neither purchase price nor receipt amount', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1' }), makeAsset({ id: 'asset-2' }), makeAsset({ id: 'asset-3', purchase_price: 20 })],
        [],
        [],
        []
      );

      expect(inventory.totals.itemsWithoutValue).toBe(2);
      expect(inventory.totals.itemsWithValue).toBe(1);
      expect(inventory.totals.itemsWithValue + inventory.totals.itemsWithoutValue).toBe(inventory.totals.itemCount);
    });
  });

  describe('photo and document counting', () => {
    it('counts documents linked via document.asset_id and combines evidence', () => {
      const inventory = buildClaimInventory(
        [makeAsset({ id: 'asset-1' }), makeAsset({ id: 'asset-2' })],
        [makeReceipt({ id: 'r1', asset_id: 'asset-1', total_amount: 100 })],
        [
          makeDocument({ id: 'd1', asset_id: 'asset-1', document_type: 'photo' }),
          makeDocument({ id: 'd2', asset_id: 'asset-1', document_type: 'manual' }),
          makeDocument({ id: 'd3', asset_id: null, document_type: 'photo' })
        ],
        []
      );

      const [first, second] = inventory.items;
      expect(first.documentCount).toBe(2);
      expect(first.evidenceCount).toBe(3);
      expect(second.documentCount).toBe(0);
      expect(second.evidenceCount).toBe(0);
    });
  });

  describe('maintenance summary', () => {
    it('reports the count and the earliest-to-latest service date range', () => {
      const inventory = buildClaimInventory(
        [],
        [],
        [],
        [
          makeServiceRecord({ id: 's1', service_date: '2025-11-15' }),
          makeServiceRecord({ id: 's2', service_date: '2023-04-02' }),
          makeServiceRecord({ id: 's3', service_date: '2026-06-30' })
        ]
      );

      expect(inventory.maintenance.serviceRecordCount).toBe(3);
      expect(inventory.maintenance.earliestServiceDate).toBe('2023-04-02');
      expect(inventory.maintenance.latestServiceDate).toBe('2026-06-30');
    });

    it('collapses to a single date when only one record exists', () => {
      const inventory = buildClaimInventory([], [], [], [makeServiceRecord({ id: 's1', service_date: '2026-01-10' })]);

      expect(inventory.maintenance.earliestServiceDate).toBe('2026-01-10');
      expect(inventory.maintenance.latestServiceDate).toBe('2026-01-10');
    });
  });

  describe('empty inputs', () => {
    it('returns a complete, honest shape with no items and no invented values', () => {
      const inventory = buildClaimInventory([], [], [], []);

      expect(inventory).toEqual({
        items: [],
        totals: {
          itemCount: 0,
          documentedValueTotal: 0,
          itemsWithValue: 0,
          itemsWithoutValue: 0
        },
        maintenance: {
          serviceRecordCount: 0,
          earliestServiceDate: null,
          latestServiceDate: null
        }
      });
    });
  });

  describe('line item identity fields', () => {
    it('passes identifiers and purchase info through untouched', () => {
      const inventory = buildClaimInventory(
        [
          makeAsset({
            id: 'asset-1',
            name: 'Dishwasher',
            brand: 'Bosch',
            model: 'SHX78CM5N',
            serial_number: 'FD1234567',
            purchase_date: '2025-02-14',
            purchase_price: 1099.99,
            retailer: 'Home Depot',
            warranty_expires_at: '2099-01-01'
          })
        ],
        [],
        [],
        []
      );

      const item = inventory.items[0];
      expect(item.assetId).toBe('asset-1');
      expect(item.name).toBe('Dishwasher');
      expect(item.brand).toBe('Bosch');
      expect(item.model).toBe('SHX78CM5N');
      expect(item.serialNumber).toBe('FD1234567');
      expect(item.purchaseDate).toBe('2025-02-14');
      expect(item.purchasePrice).toBe(1099.99);
      expect(item.retailer).toBe('Home Depot');
      expect(item.warrantyStatus).toBe('active');
    });
  });
});
