import { describe, expect, it } from 'vitest';
import { PROPERTY_TYPES, ROOM_TYPES } from '@home-folder/shared';
import { FLOOR_SUGGESTIONS } from '../lib/floorOrder';
import { deriveHasFlags } from '../lib/propertyFlags';
import {
  clampFloorCount,
  expandRoomSelection,
  numberedRoomNames,
  resolveFloorName
} from '../lib/starterRooms';
import { defaultSelectionFor } from '../lib/starterTemplates';

const NO_BASEMENT = { floorCount: 1, hasBasement: false, hasAttic: false };

function uniqueKey(room: { name: string; room_type: string; floor_name: string }) {
  return `${room.floor_name}::${room.name.trim().toLowerCase()}::${room.room_type}`;
}

describe('clampFloorCount', () => {
  it('keeps sane values', () => {
    expect(clampFloorCount(1)).toBe(1);
    expect(clampFloorCount(3)).toBe(3);
  });

  it('clamps what a number input can produce', () => {
    expect(clampFloorCount(0)).toBe(1);
    expect(clampFloorCount(-4)).toBe(1);
    expect(clampFloorCount(99)).toBe(4);
    expect(clampFloorCount(2.7)).toBe(2);
    expect(clampFloorCount(Number.NaN)).toBe(1);
  });
});

describe('resolveFloorName', () => {
  it('always sends outside spaces outside', () => {
    expect(resolveFloorName('outside', NO_BASEMENT)).toBe('Outside');
    expect(resolveFloorName('outside', { floorCount: 4, hasBasement: true, hasAttic: true })).toBe(
      'Outside'
    );
  });

  it('puts upper-floor spaces on the main floor in a single-storey home', () => {
    expect(resolveFloorName('upper', NO_BASEMENT)).toBe('Main Floor');
  });

  it('puts them upstairs once there is an upstairs', () => {
    expect(resolveFloorName('upper', { ...NO_BASEMENT, floorCount: 2 })).toBe('Second Floor');
    expect(resolveFloorName('upper', { ...NO_BASEMENT, floorCount: 3 })).toBe('Second Floor');
  });

  it('only uses the basement when there is one', () => {
    expect(resolveFloorName('lower', NO_BASEMENT)).toBe('Main Floor');
    expect(resolveFloorName('lower', { ...NO_BASEMENT, hasBasement: true })).toBe('Basement');
  });

  it('resolves the top slot to the attic when there is one', () => {
    expect(resolveFloorName('top', { ...NO_BASEMENT, hasAttic: true })).toBe('Attic');
  });

  it('degrades the top slot rather than inventing a storey', () => {
    expect(resolveFloorName('top', { ...NO_BASEMENT, floorCount: 1 })).toBe('Main Floor');
    expect(resolveFloorName('top', { ...NO_BASEMENT, floorCount: 2 })).toBe('Second Floor');
    expect(resolveFloorName('top', { ...NO_BASEMENT, floorCount: 3 })).toBe('Third Floor');
  });

  // A second floor vocabulary is how the home map ends up showing
  // "Second Floor" and "Inside" side by side.
  it('never invents a floor name outside the shared vocabulary', () => {
    const slots = ['lower', 'main', 'upper', 'top', 'outside'] as const;
    for (const slot of slots) {
      for (const floorCount of [1, 2, 3, 4]) {
        for (const hasBasement of [true, false]) {
          for (const hasAttic of [true, false]) {
            expect(FLOOR_SUGGESTIONS).toContain(
              resolveFloorName(slot, { floorCount, hasBasement, hasAttic })
            );
          }
        }
      }
    }
  });
});

describe('numberedRoomNames', () => {
  it('does not number a lone room', () => {
    expect(numberedRoomNames('Bathroom', 1)).toEqual(['Bathroom']);
  });

  it('numbers repeated rooms', () => {
    expect(numberedRoomNames('Bedroom', 3)).toEqual(['Bedroom 1', 'Bedroom 2', 'Bedroom 3']);
  });

  it('returns nothing for zero or negative counts', () => {
    expect(numberedRoomNames('Bedroom', 0)).toEqual([]);
    expect(numberedRoomNames('Bedroom', -2)).toEqual([]);
  });
});

describe('expandRoomSelection', () => {
  it('creates nothing from an empty selection', () => {
    expect(expandRoomSelection('single_family_home', {}, 2)).toEqual([]);
  });

  it('expands a counted space into numbered rooms', () => {
    const rooms = expandRoomSelection('single_family_home', { bedroom: 3 }, 2);
    expect(rooms.map((room) => room.name)).toEqual(['Bedroom 1', 'Bedroom 2', 'Bedroom 3']);
    expect(rooms.every((room) => room.room_type === 'bedroom')).toBe(true);
    expect(rooms.every((room) => room.floor_name === 'Second Floor')).toBe(true);
  });

  it('sends the first bathroom downstairs and the rest up with the bedrooms', () => {
    const rooms = expandRoomSelection('single_family_home', { bathroom: 3 }, 2);
    expect(rooms.map((room) => room.floor_name)).toEqual([
      'Main Floor',
      'Second Floor',
      'Second Floor'
    ]);
  });

  it('keeps everything on one floor in a bungalow', () => {
    const rooms = expandRoomSelection('single_family_home', { bedroom: 2, bathroom: 2 }, 1);
    const indoorFloors = new Set(rooms.map((room) => room.floor_name));
    expect(indoorFloors).toEqual(new Set(['Main Floor']));
  });

  it('honours the ceiling on a counted space', () => {
    const rooms = expandRoomSelection('single_family_home', { bedroom: 500 }, 2);
    expect(rooms).toHaveLength(8);
  });

  it('treats an uncounted space as at most one room', () => {
    const rooms = expandRoomSelection('single_family_home', { kitchen: 9 }, 2);
    expect(rooms).toHaveLength(1);
  });

  it('ignores spaces this property type does not offer', () => {
    const rooms = expandRoomSelection('condo', { yard: 1, crawl_space: 1 }, 1);
    expect(rooms).toEqual([]);
  });

  it('moves the laundry to the basement only once a basement exists', () => {
    const withoutBasement = expandRoomSelection('single_family_home', { laundry_room: 1 }, 2);
    expect(withoutBasement[0].floor_name).toBe('Main Floor');

    const withBasement = expandRoomSelection(
      'single_family_home',
      { laundry_room: 1, basement: 1 },
      2
    );
    expect(withBasement.find((room) => room.room_type === 'laundry_room')?.floor_name).toBe(
      'Basement'
    );
  });

  it('only produces room types that exist in the shared enum', () => {
    for (const type of PROPERTY_TYPES) {
      for (const room of expandRoomSelection(type, defaultSelectionFor(type), 2)) {
        expect(ROOM_TYPES).toContain(room.room_type);
      }
    }
  });

  it('never produces two rooms that collide on the unique index', () => {
    // Migration 015 is unique on (property_id, floor, lower(trim(name)),
    // room_type). A collision would fail the whole batch insert.
    for (const type of PROPERTY_TYPES) {
      for (const floorCount of [1, 2, 3, 4]) {
        const rooms = expandRoomSelection(type, defaultSelectionFor(type), floorCount);
        const keys = rooms.map(uniqueKey);
        expect(new Set(keys).size, `${type} at ${floorCount} floors collides`).toBe(keys.length);
      }
    }
  });

  it('never produces a room with a blank name', () => {
    for (const type of PROPERTY_TYPES) {
      for (const room of expandRoomSelection(type, defaultSelectionFor(type), 2)) {
        expect(room.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('produces a usable starter set for every property type', () => {
    for (const type of PROPERTY_TYPES) {
      const rooms = expandRoomSelection(type, defaultSelectionFor(type), 2);
      expect(rooms.length, `${type} produced nothing`).toBeGreaterThan(0);
    }
  });

  it('turns the default single-family answers into a whole home in one submit', () => {
    const rooms = expandRoomSelection(
      'single_family_home',
      defaultSelectionFor('single_family_home'),
      2
    );

    expect(rooms.length).toBeGreaterThanOrEqual(10);
    expect(rooms.map((room) => room.room_type)).toEqual(
      expect.arrayContaining(['kitchen', 'living_room', 'bedroom', 'bathroom', 'garage', 'yard'])
    );
  });
});

describe('deriveHasFlags', () => {
  it('sets nothing for an empty room list', () => {
    expect(deriveHasFlags([])).toEqual({
      has_garage: false,
      has_basement: false,
      has_attic: false,
      has_crawl_space: false,
      has_yard: false,
      has_shed: false
    });
  });

  it('maps each qualifying room type onto its flag', () => {
    const flags = deriveHasFlags([
      { room_type: 'garage' },
      { room_type: 'basement' },
      { room_type: 'attic' },
      { room_type: 'crawl_space' },
      { room_type: 'yard' },
      { room_type: 'shed' }
    ]);

    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it('sets no flag for rooms that imply none', () => {
    const flags = deriveHasFlags([{ room_type: 'kitchen' }, { room_type: 'bedroom' }]);
    expect(Object.values(flags).some(Boolean)).toBe(false);
  });

  // One tick, two records: the room and the column that describes it.
  it('follows from the generated starter set rather than being asked twice', () => {
    const rooms = expandRoomSelection(
      'single_family_home',
      defaultSelectionFor('single_family_home'),
      2
    );
    const flags = deriveHasFlags(rooms);

    expect(flags.has_garage).toBe(true);
    expect(flags.has_yard).toBe(true);
    expect(flags.has_basement).toBe(false);
  });

  it('leaves a flat with no outdoor flags set', () => {
    const rooms = expandRoomSelection('condo', defaultSelectionFor('condo'), 1);
    expect(Object.values(deriveHasFlags(rooms)).some(Boolean)).toBe(false);
  });
});
