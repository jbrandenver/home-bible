import { describe, expect, it } from 'vitest';
import { formatEnumLabel } from '@home-folder/shared';
import { formatAddressLine } from '../lib/properties';
import type { RepairRow } from '../lib/repairs';
import {
  buildServiceCallEmail,
  buildServiceCallSheet,
  formatFriendlyDate,
  sanitizePhoneForHref,
  serviceCallToCompactText,
  serviceCallToPlainText
} from '../lib/serviceCall';
import type { UtilityRow } from '../lib/utilities';

function makeRepair(overrides: Partial<RepairRow> = {}): RepairRow {
  return {
    id: 'repair-1',
    property_id: 'prop-1',
    room_id: null,
    asset_id: null,
    utility_id: 'util-hvac',
    title: 'HVAC unit humming for 3 days',
    description: 'Constant humming noise from the outdoor unit, started 3 days ago.',
    repair_type: 'hvac',
    status: 'open',
    priority: 'high',
    reported_date: '2026-07-26',
    completed_date: null,
    scheduled_date: '2026-07-30',
    scheduled_window: '8am – 12pm',
    contractor_name: 'XYZ Repair',
    contractor_phone: '(555) 010-2020',
    contractor_email: 'dispatch@xyzrepair.com',
    estimated_cost: null,
    actual_cost: null,
    notes: null,
    created_at: '2026-07-26T00:00:00.000Z',
    updated_at: '2026-07-26T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function makeUtility(overrides: Partial<UtilityRow> = {}): UtilityRow {
  return {
    id: 'util-hvac',
    property_id: 'prop-1',
    room_id: null,
    device_id: null,
    utility_type: 'hvac_unit',
    name: 'Heat pump',
    location_notes: 'East side of house',
    emergency_notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides
  };
}

function makeSheet(repairOverrides: Partial<RepairRow> = {}) {
  return buildServiceCallSheet({
    repair: makeRepair(repairOverrides),
    utilities: [makeUtility()],
    serviceRecords: [],
    propertyName: 'The Bransons',
    propertyAddress: '123 Main St, Denver, CO, 80202',
    locationLabel: 'Outside · East side of house',
    onSiteContact: { name: 'Alex (renter)', phone: '(555) 555-0100' },
    typeLabelFor: formatEnumLabel,
    roomLabelFor: (roomId: string) => (roomId === 'room-basement' ? 'Basement · Utility Room' : null)
  });
}

function sheetWithUtilities(utilities: UtilityRow[]) {
  return buildServiceCallSheet({
    repair: makeRepair(),
    utilities,
    serviceRecords: [],
    propertyName: 'The Bransons',
    propertyAddress: '123 Main St, Denver, CO, 80202',
    locationLabel: null,
    onSiteContact: null,
    typeLabelFor: formatEnumLabel,
    roomLabelFor: (roomId: string) => (roomId === 'room-basement' ? 'Basement · Utility Room' : null)
  });
}

describe('scheduled visit', () => {
  it('appears on the sheet and in the shared text', () => {
    const sheet = makeSheet();
    expect(sheet.scheduledVisit).toMatchObject({ date: '2026-07-30', window: '8am – 12pm' });

    const text = serviceCallToPlainText(sheet);
    expect(text).toContain('Scheduled visit:');
    expect(text).toContain('8am – 12pm');
  });

  it('is omitted when nothing is scheduled', () => {
    const sheet = makeSheet({ scheduled_date: null, scheduled_window: null });
    expect(sheet.scheduledVisit).toBeNull();
    expect(serviceCallToPlainText(sheet)).not.toContain('Scheduled visit:');
  });
});

describe('formatFriendlyDate', () => {
  it('renders a date-only string without timezone drift', () => {
    expect(formatFriendlyDate('2026-07-30')).toBe('Thu, Jul 30, 2026');
  });

  it('passes through unparseable values and handles empties', () => {
    expect(formatFriendlyDate('tomorrow-ish')).toBe('tomorrow-ish');
    expect(formatFriendlyDate(null)).toBeNull();
  });
});

describe('serviceCallToCompactText', () => {
  it('keeps the essentials: where, what, when, shut-offs, branding', () => {
    const text = serviceCallToCompactText(makeSheet());

    expect(text).toContain('SERVICE CALL — HVAC unit humming for 3 days');
    expect(text).toContain('123 Main St, Denver, CO, 80202');
    expect(text).toContain('Location: Outside · East side of house');
    expect(text).toContain('Visit:');
    expect(text).toContain('Problem: Constant humming noise');
    expect(text).toContain('On site: Alex (renter)');
    expect(text).toContain('— Shared from Our Home Folder');
  });

  it('truncates long problem descriptions', () => {
    const text = serviceCallToCompactText(makeSheet({ description: 'x'.repeat(1000) }));
    const problemLine = text.split('\n').find((line) => line.startsWith('Problem:'));
    expect(problemLine).toBeDefined();
    expect(problemLine!.length).toBeLessThanOrEqual(330);
    expect(problemLine).toContain('...');
  });

  it('only lists shut-offs that are actually on file', () => {
    const text = serviceCallToCompactText(makeSheet());
    expect(text).not.toContain('not on file');
  });
});

describe('email + phone link helpers', () => {
  it('builds a subject with the issue and the address', () => {
    const email = buildServiceCallEmail(makeSheet());
    expect(email.subject).toBe('Service call — HVAC unit humming for 3 days at 123 Main St, Denver, CO, 80202');
    expect(email.body).toContain('SHUT-OFFS & KEY LOCATIONS');
  });

  it('sanitizes phone numbers for sms/tel hrefs', () => {
    expect(sanitizePhoneForHref('(555) 010-2020')).toBe('5550102020');
    expect(sanitizePhoneForHref('+1 555-010-2020')).toBe('+15550102020');
    expect(sanitizePhoneForHref('ask for Sam')).toBeNull();
    expect(sanitizePhoneForHref(null)).toBeNull();
  });
});

describe('formatAddressLine', () => {
  it('joins the parts that are present', () => {
    expect(
      formatAddressLine({
        address_line_1: '123 Main St',
        address_line_2: '',
        city: 'Denver',
        state: 'CO',
        postal_code: '80202'
      })
    ).toBe('123 Main St, Denver, CO, 80202');
  });

  it('returns null when empty', () => {
    expect(
      formatAddressLine({ address_line_1: ' ', address_line_2: null, city: null, state: null, postal_code: null })
    ).toBeNull();
  });
});


describe('a shut-off assigned to a room (BUG-5)', () => {
  it('uses the room as its location when there is no free-text note', () => {
    const sheet = sheetWithUtilities([
      makeUtility({
        id: 'util-water',
        utility_type: 'main_water_shutoff',
        name: 'Main water shut-off',
        room_id: 'room-basement',
        location_notes: null
      })
    ]);

    const water = sheet.safety.find((item) => item.utilityType === 'main_water_shutoff');
    expect(water?.recorded).toBe(true);
    expect(water?.location).toBe('Basement · Utility Room');
  });

  it('combines the room and the note when both exist', () => {
    const sheet = sheetWithUtilities([
      makeUtility({
        id: 'util-water',
        utility_type: 'main_water_shutoff',
        name: 'Main water shut-off',
        room_id: 'room-basement',
        location_notes: 'behind the furnace'
      })
    ]);

    const water = sheet.safety.find((item) => item.utilityType === 'main_water_shutoff');
    expect(water?.location).toBe('Basement · Utility Room — behind the furnace');
  });

  it('still lists a recorded shut-off in the SMS even with no location at all', () => {
    const sheet = sheetWithUtilities([
      makeUtility({
        id: 'util-water',
        utility_type: 'main_water_shutoff',
        name: 'Main water shut-off',
        room_id: null,
        location_notes: null
      })
    ]);

    // Previously the compact builder filtered on a non-empty location, so this
    // shut-off vanished from the text message entirely.
    expect(serviceCallToCompactText(sheet)).toContain('Main water shut-off');
  });
});

describe('privacy filter false positives (BUG-4)', () => {
  it('keeps ordinary heating and hardware vocabulary readable', () => {
    const sheet = sheetWithUtilities([
      makeUtility({
        id: 'util-boiler',
        utility_type: 'furnace',
        name: 'Combination boiler',
        room_id: null,
        location_notes: 'valve is stiff — tap the cotter pin'
      })
    ]);

    const boiler = sheet.safety.find((item) => item.utilityType === 'furnace');
    expect(boiler?.name).toBe('Combination boiler');
    expect(boiler?.location).toBe('valve is stiff — tap the cotter pin');
  });

  it('still withholds genuine access codes', () => {
    const sheet = sheetWithUtilities([
      makeUtility({
        id: 'util-panel',
        utility_type: 'electrical_panel',
        name: 'Electrical panel',
        room_id: null,
        location_notes: 'behind the keypad, code 4417'
      })
    ]);

    const panel = sheet.safety.find((item) => item.utilityType === 'electrical_panel');
    expect(panel?.location).toBe('Hidden by privacy rule');
  });
});
