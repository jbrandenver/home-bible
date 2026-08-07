import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR_NAME, planRoomInserts, type PendingRoomRow } from '../lib/rooms';
import type { RoomDraft } from '../lib/rooms';

const PROPERTY_ID = 'property-1';

const FLOORS = new Map<string, string>([
  ['main floor', 'floor-main'],
  ['second floor', 'floor-second'],
  ['basement', 'floor-basement'],
  ['outside', 'floor-outside']
]);

function draft(name: string, room_type: RoomDraft['room_type'], floor_name: string): RoomDraft {
  return { name, room_type, floor_name };
}

function keyOf(row: PendingRoomRow) {
  return `${row.name.toLowerCase()}::${row.room_type}::${row.floor_id}`;
}

describe('planRoomInserts', () => {
  it('returns nothing for no drafts', () => {
    expect(planRoomInserts(PROPERTY_ID, [], [], FLOORS)).toEqual([]);
  });

  it('maps a draft onto its floor id and stamps the property', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('Kitchen', 'kitchen', 'Main Floor')], FLOORS);

    expect(rows).toEqual([
      {
        property_id: PROPERTY_ID,
        floor_id: 'floor-main',
        name: 'Kitchen',
        room_type: 'kitchen',
        sort_order: 0
      }
    ]);
  });

  it('resolves floor names case-insensitively', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('Den', 'other', 'SECOND floor')], FLOORS);
    expect(rows[0].floor_id).toBe('floor-second');
  });

  it('falls back to the default floor when a draft names none', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('Kitchen', 'kitchen', '   ')], FLOORS);
    expect(rows[0].floor_id).toBe(FLOORS.get(DEFAULT_FLOOR_NAME.toLowerCase()));
  });

  it('leaves floor_id null when the floor is unknown', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('Roof', 'other', 'Rooftop')], FLOORS);
    expect(rows[0].floor_id).toBeNull();
  });

  it('trims the name it writes', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('  Office  ', 'office', 'Main Floor')], FLOORS);
    expect(rows[0].name).toBe('Office');
  });

  it('drops drafts with a blank name', () => {
    const rows = planRoomInserts(PROPERTY_ID, [], [draft('   ', 'kitchen', 'Main Floor')], FLOORS);
    expect(rows).toEqual([]);
  });

  it('skips a room that already exists on the same floor', () => {
    const existing = [{ name: 'Kitchen', room_type: 'kitchen', floor_id: 'floor-main' }];
    const rows = planRoomInserts(PROPERTY_ID, existing, [draft('Kitchen', 'kitchen', 'Main Floor')], FLOORS);
    expect(rows).toEqual([]);
  });

  it('matches existing rooms ignoring case and surrounding space', () => {
    const existing = [{ name: '  kitchen ', room_type: 'kitchen', floor_id: 'floor-main' }];
    const rows = planRoomInserts(PROPERTY_ID, existing, [draft('Kitchen', 'kitchen', 'Main Floor')], FLOORS);
    expect(rows).toEqual([]);
  });

  it('allows the same name on a different floor', () => {
    const existing = [{ name: 'Bathroom', room_type: 'bathroom', floor_id: 'floor-main' }];
    const rows = planRoomInserts(
      PROPERTY_ID,
      existing,
      [draft('Bathroom', 'bathroom', 'Second Floor')],
      FLOORS
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].floor_id).toBe('floor-second');
  });

  it('allows the same name with a different room type', () => {
    const existing = [{ name: 'Storage', room_type: 'closet', floor_id: 'floor-main' }];
    const rows = planRoomInserts(PROPERTY_ID, existing, [draft('Storage', 'other', 'Main Floor')], FLOORS);
    expect(rows).toHaveLength(1);
  });

  it('deduplicates drafts against each other, not only against storage', () => {
    // A starter set must never emit two identical rows: migration 015's partial
    // unique index would reject the whole array insert.
    const rows = planRoomInserts(
      PROPERTY_ID,
      [],
      [draft('Bathroom', 'bathroom', 'Main Floor'), draft('bathroom', 'bathroom', 'Main Floor')],
      FLOORS
    );

    expect(rows).toHaveLength(1);
  });

  it('produces no two rows sharing the unique-index key for a full starter-sized set', () => {
    const drafts: RoomDraft[] = [
      draft('Kitchen', 'kitchen', 'Main Floor'),
      draft('Living room', 'living_room', 'Main Floor'),
      draft('Dining room', 'dining_room', 'Main Floor'),
      draft('Entryway', 'entryway', 'Main Floor'),
      draft('Bathroom', 'bathroom', 'Main Floor'),
      draft('Primary bedroom', 'bedroom', 'Second Floor'),
      draft('Bedroom 2', 'bedroom', 'Second Floor'),
      draft('Bedroom 3', 'bedroom', 'Second Floor'),
      draft('Bathroom 2', 'bathroom', 'Second Floor'),
      draft('Laundry room', 'laundry_room', 'Basement'),
      draft('Garage', 'garage', 'Outside'),
      draft('Yard', 'yard', 'Outside')
    ];

    const rows = planRoomInserts(PROPERTY_ID, [], drafts, FLOORS);

    expect(rows).toHaveLength(drafts.length);
    expect(new Set(rows.map(keyOf)).size).toBe(drafts.length);
  });

  it('keeps only the new rooms when a starter set is re-applied over existing ones', () => {
    const existing = [
      { name: 'Kitchen', room_type: 'kitchen', floor_id: 'floor-main' },
      { name: 'Garage', room_type: 'garage', floor_id: 'floor-outside' }
    ];

    const rows = planRoomInserts(
      PROPERTY_ID,
      existing,
      [
        draft('Kitchen', 'kitchen', 'Main Floor'),
        draft('Garage', 'garage', 'Outside'),
        draft('Shed', 'shed', 'Outside')
      ],
      FLOORS
    );

    expect(rows.map((row) => row.name)).toEqual(['Shed']);
  });
});
