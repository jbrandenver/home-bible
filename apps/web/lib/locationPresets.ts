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

/** Floor/area name used for indoor spaces created from a preset. */
const INSIDE_AREA = 'Inside';

/** Value that opens the "name a new room" free-text field. */
export const LOCATION_CUSTOM_VALUE = 'preset:__custom__';

export type LocationPreset = {
  value: string;
  label: string;
  room_type: RoomType;
  /** Indoor presets land on the "Inside" floor; outdoor ones on "Outside". */
  indoor?: boolean;
};

// Indoor rooms people most often need mid-form (a device or utility turns out
// to live in a room they never mapped). Listed before the outdoor set because
// most records are indoors; the UI groups them separately.
export const INDOOR_LOCATION_PRESETS: LocationPreset[] = [
  { value: 'preset:kitchen', label: 'Kitchen', room_type: 'kitchen', indoor: true },
  { value: 'preset:living-room', label: 'Living room', room_type: 'living_room', indoor: true },
  { value: 'preset:dining-room', label: 'Dining room', room_type: 'dining_room', indoor: true },
  { value: 'preset:primary-bedroom', label: 'Primary bedroom', room_type: 'bedroom', indoor: true },
  { value: 'preset:bedroom', label: 'Bedroom', room_type: 'bedroom', indoor: true },
  { value: 'preset:bathroom', label: 'Bathroom', room_type: 'bathroom', indoor: true },
  { value: 'preset:office', label: 'Office', room_type: 'office', indoor: true },
  { value: 'preset:laundry-room', label: 'Laundry room', room_type: 'laundry_room', indoor: true },
  { value: 'preset:utility-room', label: 'Utility room', room_type: 'utility_room', indoor: true },
  { value: 'preset:basement', label: 'Basement', room_type: 'basement', indoor: true },
  { value: 'preset:attic', label: 'Attic', room_type: 'attic', indoor: true },
  { value: 'preset:hallway', label: 'Hallway', room_type: 'hallway', indoor: true },
  { value: 'preset:entryway', label: 'Entryway', room_type: 'entryway', indoor: true },
  { value: 'preset:closet', label: 'Closet', room_type: 'closet', indoor: true },
  { value: 'preset:crawl-space', label: 'Crawl space', room_type: 'crawl_space', indoor: true }
];

export const OUTDOOR_LOCATION_PRESETS: LocationPreset[] = [
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

/** Every preset, indoor first. Kept exported under its original name so the
 * existing call sites and tests continue to work unchanged. */
export const LOCATION_PRESETS: LocationPreset[] = [
  ...INDOOR_LOCATION_PRESETS,
  ...OUTDOOR_LOCATION_PRESETS
];

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/** Presets whose name isn't already taken by one of the property's rooms. */
export function getAvailableLocationPresets(rooms: Array<{ name: string }>) {
  const taken = new Set(rooms.map((room) => normalizeName(room.name)));
  return LOCATION_PRESETS.filter((preset) => !taken.has(normalizeName(preset.label)));
}

/** Available presets split for grouped dropdowns. */
export function getGroupedLocationPresets(rooms: Array<{ name: string }>) {
  const available = getAvailableLocationPresets(rooms);
  return {
    indoor: available.filter((preset) => preset.indoor),
    outdoor: available.filter((preset) => !preset.indoor)
  };
}

export function isLocationPresetValue(value: string) {
  return value.startsWith(LOCATION_PRESET_PREFIX);
}

/** True when the picker should show its "name the room" text field. */
export function isCustomLocationValue(value: string) {
  return value === LOCATION_CUSTOM_VALUE;
}

/**
 * Build the resolvable value for a room the user typed by hand. Encoding the
 * name into the value keeps the whole picker a single string, so every existing
 * caller (resolve → write → rollback on failure) works without change.
 */
export function customLocationValue(name: string, roomType: RoomType = 'other') {
  return `${LOCATION_PRESET_PREFIX}custom:${roomType}:${name.trim()}`;
}

function parseCustomLocationValue(value: string): LocationPreset | null {
  const marker = `${LOCATION_PRESET_PREFIX}custom:`;
  if (!value.startsWith(marker)) {
    return null;
  }

  const rest = value.slice(marker.length);
  const separator = rest.indexOf(':');
  if (separator < 0) {
    return null;
  }

  const roomType = rest.slice(0, separator) as RoomType;
  const label = rest.slice(separator + 1).trim();
  if (!label) {
    return null;
  }

  // A hand-named room is indoors unless its type says otherwise, so it lands
  // on the "Inside" floor with the rest of the house.
  const outdoorTypes: RoomType[] = ['yard', 'exterior', 'shed', 'patio', 'deck', 'garage'];
  return { value, label, room_type: roomType, indoor: !outdoorTypes.includes(roomType) };
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

  const preset =
    LOCATION_PRESETS.find((candidate) => candidate.value === value) ??
    parseCustomLocationValue(value);
  if (!preset) {
    return { roomId: null, createdRoomId: null };
  }

  const areaName = preset.indoor ? INSIDE_AREA : OUTSIDE_AREA;

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
      floor_name: areaName
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
    { name: preset.label, room_type: preset.room_type, floor_name: areaName }
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
