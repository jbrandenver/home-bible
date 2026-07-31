import { describe, expect, it } from 'vitest';
import {
  buildDepositPacket,
  formatCentsAsCurrency,
  type ConditionReportDocument,
  type ConditionReportEntryRow,
  type ConditionReportRow,
  type PacketEntry
} from '../lib/conditionReports';
import type { TenancyRow } from '../lib/tenancies';

function makeReport(overrides: Partial<ConditionReportRow> = {}): ConditionReportRow {
  return {
    id: 'report-1',
    property_id: 'property-1',
    tenancy_id: null,
    report_type: 'move_in',
    status: 'draft',
    report_date: '2026-08-01',
    conducted_by: 'Jesse Branson',
    summary: null,
    notes: null,
    completed_at: null,
    created_by: 'user-1',
    created_at: '2026-08-01T17:04:00.000Z',
    updated_at: '2026-08-01T17:04:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function makeEntry(overrides: Partial<PacketEntry> = {}): PacketEntry {
  return {
    id: 'entry-1',
    report_id: 'report-1',
    property_id: 'property-1',
    room_id: null,
    area_label: null,
    condition_rating: null,
    notes: null,
    sort_order: 0,
    created_by: 'user-1',
    created_at: '2026-08-01T17:10:00.000Z',
    updated_at: '2026-08-01T17:10:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function makePhoto(overrides: Partial<ConditionReportDocument> = {}): ConditionReportDocument {
  return {
    id: 'doc-1',
    title: 'Condition photo',
    document_type: 'condition_photo',
    created_at: '2026-08-01T17:12:00.000Z',
    condition_report_entry_id: null,
    ...overrides
  };
}

function makeTenancy(overrides: Partial<TenancyRow> = {}): TenancyRow {
  return {
    id: 'tenancy-1',
    property_id: 'property-1',
    label: 'Unit A — 2026 lease',
    tenant_names: 'A. Tenant',
    start_date: '2026-08-01',
    end_date: null,
    deposit_amount_cents: 240000,
    deposit_currency: 'usd',
    deposit_returned_on: null,
    status: 'active',
    notes: null,
    created_by: 'user-1',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

describe('formatCentsAsCurrency', () => {
  it('converts integer cents to a dollar string', () => {
    expect(formatCentsAsCurrency(240000)).toBe('$2,400.00');
    expect(formatCentsAsCurrency(123456)).toBe('$1,234.56');
    expect(formatCentsAsCurrency(5)).toBe('$0.05');
    expect(formatCentsAsCurrency(0)).toBe('$0.00');
  });

  it('returns null for missing amounts', () => {
    expect(formatCentsAsCurrency(null)).toBeNull();
    expect(formatCentsAsCurrency(undefined)).toBeNull();
  });

  it('falls back to a plain string for unknown currency codes', () => {
    expect(formatCentsAsCurrency(1000, 'not-a-code')).toBe('NOT-A-CODE 10.00');
  });
});

describe('buildDepositPacket', () => {
  it('returns an empty but well-formed packet for a report with no entries or photos', () => {
    const packet = buildDepositPacket(makeReport(), [], [], 'Maple Duplex', null);

    expect(packet.propertyNickname).toBe('Maple Duplex');
    expect(packet.reportType).toBe('move_in');
    expect(packet.sections).toEqual([]);
    expect(packet.totalEntries).toBe(0);
    expect(packet.totalPhotos).toBe(0);
    expect(packet.unassignedPhotoCount).toBe(0);
    expect(packet.tenancy).toBeNull();
  });

  it('groups entries by area label, falling back to room name, then General', () => {
    const entries: PacketEntry[] = [
      makeEntry({ id: 'e1', area_label: 'Kitchen', sort_order: 0 }),
      makeEntry({ id: 'e2', room_id: 'room-1', room_name: 'Primary bedroom', sort_order: 1 }),
      makeEntry({ id: 'e3', area_label: 'Kitchen', sort_order: 2 }),
      makeEntry({ id: 'e4', sort_order: 3 })
    ];

    const packet = buildDepositPacket(makeReport(), entries, [], 'Maple Duplex', null);

    expect(packet.sections.map((section) => section.title)).toEqual([
      'Kitchen',
      'Primary bedroom',
      'General'
    ]);
    expect(packet.sections[0].entries.map((entry) => entry.id)).toEqual(['e1', 'e3']);
    expect(packet.totalEntries).toBe(4);
  });

  it('orders entries by sort_order, then created_at', () => {
    const entries: PacketEntry[] = [
      makeEntry({ id: 'later', area_label: 'Hall', sort_order: 1 }),
      makeEntry({
        id: 'tie-second',
        area_label: 'Hall',
        sort_order: 0,
        created_at: '2026-08-01T18:00:00.000Z'
      }),
      makeEntry({
        id: 'tie-first',
        area_label: 'Hall',
        sort_order: 0,
        created_at: '2026-08-01T17:00:00.000Z'
      })
    ];

    const packet = buildDepositPacket(makeReport(), entries, [], 'Maple Duplex', null);

    expect(packet.sections[0].entries.map((entry) => entry.id)).toEqual([
      'tie-first',
      'tie-second',
      'later'
    ]);
  });

  it('excludes soft-deleted entries', () => {
    const entries: PacketEntry[] = [
      makeEntry({ id: 'kept', area_label: 'Kitchen' }),
      makeEntry({ id: 'gone', area_label: 'Kitchen', deleted_at: '2026-08-02T00:00:00.000Z' })
    ];

    const packet = buildDepositPacket(makeReport(), entries, [], 'Maple Duplex', null);

    expect(packet.totalEntries).toBe(1);
    expect(packet.sections[0].entries.map((entry) => entry.id)).toEqual(['kept']);
  });

  it('counts condition photos per entry, ignores other document types, and totals general photos', () => {
    const entries: PacketEntry[] = [
      makeEntry({ id: 'e1', area_label: 'Kitchen' }),
      makeEntry({ id: 'e2', area_label: 'Bathroom' })
    ];
    const documents: ConditionReportDocument[] = [
      makePhoto({ id: 'p1', condition_report_entry_id: 'e1' }),
      makePhoto({ id: 'p2', condition_report_entry_id: 'e1' }),
      makePhoto({ id: 'p3', condition_report_entry_id: null }),
      makePhoto({ id: 'p4', condition_report_entry_id: 'entry-that-was-deleted' }),
      makePhoto({ id: 'lease', document_type: 'tenancy_document', condition_report_entry_id: 'e1' })
    ];

    const packet = buildDepositPacket(makeReport(), entries, documents, 'Maple Duplex', null);

    expect(packet.sections[0].entries[0].photoCount).toBe(2);
    expect(packet.sections[1].entries[0].photoCount).toBe(0);
    expect(packet.totalPhotos).toBe(4);
    // A photo pointing at a removed entry still counts as general evidence.
    expect(packet.unassignedPhotoCount).toBe(2);
  });

  it('passes report and entry timestamps through untouched', () => {
    const report = makeReport({
      created_at: '2026-08-01T17:04:11.000Z',
      completed_at: '2026-08-01T19:45:02.000Z',
      status: 'completed'
    });
    const entries: PacketEntry[] = [
      makeEntry({ id: 'e1', area_label: 'Kitchen', created_at: '2026-08-01T17:10:33.000Z' })
    ];

    const packet = buildDepositPacket(report, entries, [], 'Maple Duplex', null);

    expect(packet.createdAt).toBe('2026-08-01T17:04:11.000Z');
    expect(packet.completedAt).toBe('2026-08-01T19:45:02.000Z');
    expect(packet.status).toBe('completed');
    expect(packet.sections[0].entries[0].recordedAt).toBe('2026-08-01T17:10:33.000Z');
  });

  it('formats the linked tenancy deposit from cents to dollars', () => {
    const packet = buildDepositPacket(
      makeReport({ tenancy_id: 'tenancy-1' }),
      [],
      [],
      'Maple Duplex',
      makeTenancy({ deposit_amount_cents: 123456 })
    );

    expect(packet.tenancy).not.toBeNull();
    expect(packet.tenancy?.depositAmountCents).toBe(123456);
    expect(packet.tenancy?.depositFormatted).toBe('$1,234.56');
    expect(packet.tenancy?.label).toBe('Unit A — 2026 lease');
  });

  it('keeps a missing deposit as null rather than zero', () => {
    const packet = buildDepositPacket(
      makeReport(),
      [],
      [],
      'Maple Duplex',
      makeTenancy({ deposit_amount_cents: null })
    );

    expect(packet.tenancy?.depositAmountCents).toBeNull();
    expect(packet.tenancy?.depositFormatted).toBeNull();
  });
});

// The entry row type is exported for consumers; keep a compile-time check that
// PacketEntry stays a superset of it.
const _entryIsPacketEntry: PacketEntry = {} as ConditionReportEntryRow;
void _entryIsPacketEntry;
