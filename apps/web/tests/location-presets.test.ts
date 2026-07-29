import { beforeEach, describe, expect, it } from 'vitest';
import {
  LOCATION_PRESETS,
  getAvailableLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId
} from '../lib/locationPresets';

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
    await expect(resolveLocationRoomId('room-123', { mode: 'demo' })).resolves.toBe('room-123');
    await expect(resolveLocationRoomId('', { mode: 'demo' })).resolves.toBeNull();
    await expect(resolveLocationRoomId('preset:not-a-real-one', { mode: 'demo' })).resolves.toBeNull();
  });

  it('creates the demo space once and reuses it on later picks', async () => {
    const firstId = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(firstId).toBeTruthy();

    const rooms = readDemoRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ name: 'Back yard', room_type: 'yard', floor_name: 'Outside' });

    const secondId = await resolveLocationRoomId('preset:back-yard', { mode: 'demo' });
    expect(secondId).toBe(firstId);
    expect(readDemoRooms()).toHaveLength(1);
  });

  it('links to an existing demo room with a matching name instead of duplicating it', async () => {
    store.set(
      'homeFolder.rooms',
      JSON.stringify([{ id: 'existing-garage', name: 'garage', room_type: 'garage', floor_name: 'Main Floor' }])
    );

    const resolved = await resolveLocationRoomId('preset:garage', { mode: 'demo' });
    expect(resolved).toBe('existing-garage');
    expect(readDemoRooms()).toHaveLength(1);
  });
});
