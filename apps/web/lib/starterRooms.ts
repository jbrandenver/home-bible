// Turning "what this home has" into actual room drafts.
//
// Pure and separate from the grid that collects the answers, because the repo
// tests logic and not components: every rule here — what a floor is called,
// how repeated rooms are numbered, which slot the second bathroom lands on —
// is a rule that will be argued about, so it needs to be assertable.

import type { PropertyType } from '@home-folder/shared';
import type { RoomDraft } from './rooms';
import { offeredSpacesFor, type FloorSlot, type SpaceSelection } from './starterTemplates';

/**
 * Floor names come from FLOOR_SUGGESTIONS in floorOrder.ts and nowhere else.
 * A second vocabulary is how the home map ends up showing "Second Floor" and
 * "Inside" side by side.
 */
const BASEMENT = 'Basement';
const MAIN_FLOOR = 'Main Floor';
const SECOND_FLOOR = 'Second Floor';
const THIRD_FLOOR = 'Third Floor';
const ATTIC = 'Attic';
const OUTSIDE = 'Outside';

export const MIN_FLOOR_COUNT = 1;
export const MAX_FLOOR_COUNT = 4;

export type FloorContext = {
  /** Floors above ground. Clamped; a person can type anything into a number input. */
  floorCount: number;
  hasBasement: boolean;
  hasAttic: boolean;
};

export function clampFloorCount(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_FLOOR_COUNT;
  }
  return Math.min(MAX_FLOOR_COUNT, Math.max(MIN_FLOOR_COUNT, Math.floor(value)));
}

/**
 * Which floor a slot means for this particular home.
 *
 * Everything degrades toward the main floor rather than inventing a storey:
 * a bungalow's bedrooms are on the main floor, and a home with no basement
 * keeps its laundry upstairs where it actually is.
 */
export function resolveFloorName(slot: FloorSlot, context: FloorContext): string {
  const floors = clampFloorCount(context.floorCount);

  switch (slot) {
    case 'outside':
      return OUTSIDE;
    case 'lower':
      return context.hasBasement ? BASEMENT : MAIN_FLOOR;
    case 'main':
      return MAIN_FLOOR;
    case 'upper':
      return floors >= 2 ? SECOND_FLOOR : MAIN_FLOOR;
    case 'top':
      if (context.hasAttic) return ATTIC;
      if (floors >= 3) return THIRD_FLOOR;
      return floors >= 2 ? SECOND_FLOOR : MAIN_FLOOR;
    default:
      return MAIN_FLOOR;
  }
}

/**
 * Names for a repeated space.
 *
 * One of something is just "Bathroom" — numbering a lone room reads like a
 * database. More than one gets numbered plainly; people rename them to
 * "Kids' bathroom" later, and renaming is one tap.
 */
export function numberedRoomNames(label: string, count: number): string[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [label];
  }
  return Array.from({ length: count }, (_, index) => `${label} ${index + 1}`);
}

export function floorContextFor(selection: SpaceSelection, floorCount: number): FloorContext {
  return {
    floorCount: clampFloorCount(floorCount),
    hasBasement: (selection.basement ?? 0) > 0,
    hasAttic: (selection.attic ?? 0) > 0
  };
}

/**
 * The whole starter set, as rooms ready to write.
 *
 * Catalog order is preserved so the created list reads as a walk through the
 * home rather than in whatever order the checkboxes were touched.
 */
export function expandRoomSelection(
  propertyType: PropertyType,
  selection: SpaceSelection,
  floorCount: number
): RoomDraft[] {
  const context = floorContextFor(selection, floorCount);
  const drafts: RoomDraft[] = [];

  for (const space of offeredSpacesFor(propertyType)) {
    const requested = selection[space.key] ?? 0;
    const ceiling = space.counted ? space.max : 1;
    const count = Math.max(0, Math.min(Math.floor(requested), ceiling));

    if (count <= 0) {
      continue;
    }

    numberedRoomNames(space.label, count).forEach((name, index) => {
      // The first bathroom is usually downstairs and the rest are with the
      // bedrooms; overflowSlot is how a space says so.
      const slot = index > 0 && space.overflowSlot ? space.overflowSlot : space.slot;

      drafts.push({
        name,
        room_type: space.room_type,
        floor_name: resolveFloorName(slot, context)
      });
    });
  }

  return drafts;
}

/** How many rooms the current ticks would create — for the grid's summary line. */
export function countSelectedSpaces(propertyType: PropertyType, selection: SpaceSelection): number {
  return expandRoomSelection(propertyType, selection, MIN_FLOOR_COUNT).length;
}
