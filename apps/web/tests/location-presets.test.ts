import { beforeEach, describe, expect, it } from 'vitest';
import {
  LOCATION_CUSTOM_VALUE,
  LOCATION_PRESETS,
  customLocationValue,
  getAvailableLocationPresets,
  getGroupedLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../lib/locationPresets';
import { roomSelectionValue } from '../components/RoomLocationSelect';
import { getDemoRooms } from '../lib/demoStorage';

// demoStorage reads window.localStorage at call time, so a minimal in-memory
// stand-in keeps the demo-mode tests hermetic (node env, no browser).
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    }
  };
});

function readDemoRooms() {
  return JSON.parse(store.get('homeFolder.rooms') ?? '[]') as Array<{
    id: string;
    name: string;
    room_type: string;
    floor_name: string;
  }>;
}

describe('location presets', () => {
  it('offers outdoor presets and marks their values as presets', () => {
    expect(LOCATION_PRESETS.length).toBeGreaterThan(0);
    for (const preset of LOCATION_PRESETS) {
      expect(isLocationPresetValue(preset.value)).toBe(true);
    }
    expect(isLocationPresetValue('some-room-uuid')).toBe(false);
  });

  it('hides presets whose name is already taken by a room (case-insensitive)', () => {
    const available = getAvailableLocationPresets([{ name: 'back YARD ' }, { name: 'Garage' }]);
    const labels = available.map((preset) => preset.label);
    expect(labels).not.toContain('Back yard');
    expect(labels).not.toContain('Garage');
    expect(labels).toContain('Front yard');
  });

  it('passes plain room ids through and returns null for empty values', async () => {
    await expect(resolveLocationRoomId('room-123', { mode: 'demo' })).resolves.toEqual({
      roomId: 'room-123',
      createdRoomId: null
    });
    await expect(resolveLocationRoomId('', { mode: 'demo' })).resolves.toEqual({
      roomId: null,
      createdRoomId: null
    });
    await expect(resolveLocationRoomId('preset:not-a-real-one', { mode: 'demo' })).resolves.toEqual({
      roomId: null,
      createdRoomId: null
    });
  });

  it('creates the demo space once and reuses it on later picks', async () => {
    const first = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(first.roomId).toBeTruthy();
    // Only the first call brings a room into existence.
    expect(first.createdRoomId).toBe(first.roomId);

    const rooms = readDemoRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ name: 'Back yard', room_type: 'yard', floor_name: 'Outside' });

    const second = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(second.roomId).toBe(first.roomId);
    expect(second.createdRoomId).toBeNull();
    expect(readDemoRooms()).toHaveLength(1);
  });

  it('rolls the new space back when the save it was created for fails', async () => {
    const resolved = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(readDemoRooms()).toHaveLength(1);

    // Simulates the utility insert throwing after the room was created.
    await rollbackCreatedLocation(resolved.createdRoomId, { mode: 'demo' });

    expect(readDemoRooms()).toHaveLength(0);
    // The preset is offered again, rather than silently moving to "Rooms".
    expect(getAvailableLocationPresets(readDemoRooms()).map((p) => p.label)).toContain('Back yard');
  });

  it('never rolls back a room it did not create', async () => {
    store.set(
      'homeFolder.rooms',
      JSON.stringify([{ id: 'pre-existing', name: 'Back yard', room_type: 'yard', floor_name: 'Outside' }])
    );

    const resolved = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(resolved.roomId).toBe('pre-existing');
    expect(resolved.createdRoomId).toBeNull();

    await rollbackCreatedLocation(resolved.createdRoomId, { mode: 'demo' });
    expect(readDemoRooms()).toHaveLength(1);
  });

  it('links to an existing demo room with a matching name instead of duplicating it', async () => {
    store.set(
      'homeFolder.rooms',
      JSON.stringify([{ id: 'existing-garage', name: 'garage', room_type: 'garage', floor_name: 'Main Floor' }])
    );

    const resolved = await resolveLocationRoomId('preset:garage', { mode: 'demo' });
    expect(resolved.roomId).toBe('existing-garage');
    expect(resolved.createdRoomId).toBeNull();
    expect(readDemoRooms()).toHaveLength(1);
  });
});

describe('indoor presets and custom rooms', () => {
  it('offers indoor rooms, not just outdoor spots', () => {
    const grouped = getGroupedLocationPresets([]);
    expect(grouped.indoor.length).toBeGreaterThan(0);
    expect(grouped.outdoor.length).toBeGreaterThan(0);
    expect(grouped.indoor.map((p) => p.label)).toContain('Bedroom');
    expect(grouped.indoor.map((p) => p.label)).toContain('Basement');
    // Every indoor preset is flagged indoor so created rooms land on the
    // "Inside" floor rather than with the yards.
    expect(grouped.indoor.every((p) => p.indoor === true)).toBe(true);
    expect(grouped.outdoor.every((p) => !p.indoor)).toBe(true);
  });

  it('hides presets whose name a room already uses, in both groups', () => {
    const grouped = getGroupedLocationPresets([{ name: 'Kitchen' }, { name: 'back yard' }]);
    expect(grouped.indoor.map((p) => p.label)).not.toContain('Kitchen');
    expect(grouped.outdoor.map((p) => p.label)).not.toContain('Back yard');
  });

  it('round-trips a hand-typed room name through the picker value', () => {
    const value = roomSelectionValue(LOCATION_CUSTOM_VALUE, '  Guest bedroom  ');
    expect(value).toBe(customLocationValue('Guest bedroom'));
    expect(isLocationPresetValue(value as string)).toBe(true);
  });

  it('refuses to save a custom room with no name', () => {
    expect(roomSelectionValue(LOCATION_CUSTOM_VALUE, '   ')).toBeNull();
  });

  it('passes plain room ids straight through', () => {
    expect(roomSelectionValue('room-123', '')).toBe('room-123');
  });

  it('creates a hand-named room and reports it for rollback', async () => {
    const value = customLocationValue('Wine cellar');
    const resolved = await resolveLocationRoomId(value, { mode: 'demo' });
    expect(resolved.roomId).toBeTruthy();
    expect(resolved.createdRoomId).toBe(resolved.roomId);
    expect(getDemoRooms().some((room: { name: string }) => room.name === 'Wine cellar')).toBe(true);

    await rollbackCreatedLocation(resolved.createdRoomId, { mode: 'demo' });
    expect(getDemoRooms().some((room: { name: string }) => room.name === 'Wine cellar')).toBe(false);
  });
});
