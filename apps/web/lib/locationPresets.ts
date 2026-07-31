import type { RoomType } from '@home-folder/shared';
import { getDemoRooms, setDemoRooms, type DemoRoom } from './demoStorage';
import { createRoomsForProperty, deleteRoomForProperty, getRoomsForProperty } from './rooms';

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

export type ResolvedLocation = {
  roomId: string | null;
  /**
   * Set only when this call brought a new room into existence. Callers use it
   * to undo that room if the write it was created for then fails, which would
   * otherwise leave an empty "Back yard" on the home map and quietly move the
   * preset out of the dropdown.
   */
  createdRoomId: string | null;
};

/**
 * Turn a Location dropdown value into a room id. Plain room ids pass through;
 * preset values get their space created (or matched by name if it already
 * exists) and the resulting room id is returned.
 */
export async function resolveLocationRoomId(
  value: string,
  context: LocationResolutionContext
): Promise<ResolvedLocation> {
  if (!value) {
    return { roomId: null, createdRoomId: null };
  }

  if (!isLocationPresetValue(value)) {
    return { roomId: value, createdRoomId: null };
  }

  const preset = LOCATION_PRESETS.find((candidate) => candidate.value === value);
  if (!preset) {
    return { roomId: null, createdRoomId: null };
  }

  if (context.mode === 'demo') {
    const demoRooms = getDemoRooms();
    const existing = demoRooms.find((room) => normalizeName(room.name) === normalizeName(preset.label));
    if (existing) {
      return { roomId: existing.id, createdRoomId: null };
    }

    const created: DemoRoom = {
      id: crypto.randomUUID(),
      name: preset.label,
      room_type: preset.room_type,
      floor_name: OUTSIDE_AREA
    };
    setDemoRooms([...demoRooms, created]);
    return { roomId: created.id, createdRoomId: created.id };
  }

  const existingRooms = await getRoomsForProperty(context.propertyId);
  const alreadyThere = existingRooms.find(
    (room) => normalizeName(room.name) === normalizeName(preset.label)
  );
  if (alreadyThere) {
    return { roomId: alreadyThere.id, createdRoomId: null };
  }

  const allRooms = await createRoomsForProperty(context.propertyId, [
    { name: preset.label, room_type: preset.room_type, floor_name: OUTSIDE_AREA }
  ]);

  const created = allRooms.find((room) => normalizeName(room.name) === normalizeName(preset.label));
  if (!created) {
    throw new Error('Failed to create the selected location.');
  }

  return { roomId: created.id, createdRoomId: created.id };
}

/** Undo a room created by resolveLocationRoomId when the follow-up write failed. */
export async function rollbackCreatedLocation(
  createdRoomId: string | null,
  context: LocationResolutionContext
): Promise<void> {
  if (!createdRoomId) {
    return;
  }

  try {
    if (context.mode === 'demo') {
      setDemoRooms(getDemoRooms().filter((room) => room.id !== createdRoomId));
      return;
    }

    await deleteRoomForProperty(context.propertyId, createdRoomId);
  } catch {
    // Best effort: the original failure is what the user needs to see.
  }
}
