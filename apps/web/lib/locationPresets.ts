import type { RoomType } from '@home-folder/shared';
import { getDemoRooms, setDemoRooms, type DemoRoom } from './demoStorage';
import { createRoomsForProperty } from './rooms';

/**
 * Preset locations offered in "Location" dropdowns (utilities, etc.) so people
 * can point at places that usually aren't mapped as rooms — the back yard, the
 * north side of the house. Picking one creates a real room/space record on
 * save, so the location shows up everywhere rooms do.
 */

export const LOCATION_PRESET_PREFIX = 'preset:';

/** Floor/area name used for the created outdoor spaces. */
const OUTSIDE_AREA = 'Outside';

export type LocationPreset = {
  value: string;
  label: string;
  room_type: RoomType;
};

export const LOCATION_PRESETS: LocationPreset[] = [
  { value: 'preset:front-yard', label: 'Front yard', room_type: 'yard' },
  { value: 'preset:back-yard', label: 'Back yard', room_type: 'yard' },
  { value: 'preset:side-yard', label: 'Side yard', room_type: 'yard' },
  { value: 'preset:north-side', label: 'North side of house', room_type: 'exterior' },
  { value: 'preset:south-side', label: 'South side of house', room_type: 'exterior' },
  { value: 'preset:east-side', label: 'East side of house', room_type: 'exterior' },
  { value: 'preset:west-side', label: 'West side of house', room_type: 'exterior' },
  { value: 'preset:garage', label: 'Garage', room_type: 'garage' },
  { value: 'preset:driveway', label: 'Driveway', room_type: 'exterior' },
  { value: 'preset:shed', label: 'Shed', room_type: 'shed' },
  { value: 'preset:patio', label: 'Patio', room_type: 'patio' },
  { value: 'preset:deck', label: 'Deck', room_type: 'deck' },
  { value: 'preset:roof', label: 'Roof', room_type: 'exterior' }
];

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/** Presets whose name isn't already taken by one of the property's rooms. */
export function getAvailableLocationPresets(rooms: Array<{ name: string }>) {
  const taken = new Set(rooms.map((room) => normalizeName(room.name)));
  return LOCATION_PRESETS.filter((preset) => !taken.has(normalizeName(preset.label)));
}

export function isLocationPresetValue(value: string) {
  return value.startsWith(LOCATION_PRESET_PREFIX);
}

export type LocationResolutionContext =
  | { mode: 'demo' }
  | { mode: 'supabase'; propertyId: string };

/**
 * Turn a Location dropdown value into a room id. Plain room ids pass through;
 * preset values get their space created (or matched by name if it already
 * exists) and the resulting room id is returned.
 */
export async function resolveLocationRoomId(
  value: string,
  context: LocationResolutionContext
): Promise<string | null> {
  if (!value) {
    return null;
  }

  if (!isLocationPresetValue(value)) {
    return value;
  }

  const preset = LOCATION_PRESETS.find((candidate) => candidate.value === value);
  if (!preset) {
    return null;
  }

  if (context.mode === 'demo') {
    const demoRooms = getDemoRooms();
    const existing = demoRooms.find((room) => normalizeName(room.name) === normalizeName(preset.label));
    if (existing) {
      return existing.id;
    }

    const created: DemoRoom = {
      id: crypto.randomUUID(),
      name: preset.label,
      room_type: preset.room_type,
      floor_name: OUTSIDE_AREA
    };
    setDemoRooms([...demoRooms, created]);
    return created.id;
  }

  const allRooms = await createRoomsForProperty(context.propertyId, [
    { name: preset.label, room_type: preset.room_type, floor_name: OUTSIDE_AREA }
  ]);

  const created = allRooms.find((room) => normalizeName(room.name) === normalizeName(preset.label));
  if (!created) {
    throw new Error('Failed to create the selected location.');
  }

  return created.id;
}
