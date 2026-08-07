// The six "what this property has" booleans, derived from the rooms.
//
// These columns have existed since migration 002 and no form ever wrote them.
// The temptation is to collect them separately — a second set of tick boxes in
// onboarding, mirroring the ones in Settings. That would make them a second
// source of truth for a fact the room list already states, which is exactly
// the duplicate-entry problem this work exists to remove.
//
// So they are derived, in one direction only: rooms are the truth, flags
// follow. (Note the seasonal plan does NOT read these — maintenance.tsx
// derives yard and basement from room types directly. These are for Settings
// and for anything later that wants a cheap answer without loading rooms.)

import type { RoomDraft } from './rooms';
import type { PropertyFeatureFlag } from './starterTemplates';

export type PropertyFeatureFlags = Record<PropertyFeatureFlag, boolean>;

/** room_type → the column it implies. Room types not listed imply nothing. */
const FLAG_BY_ROOM_TYPE: Record<string, PropertyFeatureFlag> = {
  garage: 'has_garage',
  basement: 'has_basement',
  attic: 'has_attic',
  crawl_space: 'has_crawl_space',
  yard: 'has_yard',
  shed: 'has_shed'
};

export const ALL_FEATURE_FLAGS: ReadonlyArray<PropertyFeatureFlag> = [
  'has_garage',
  'has_basement',
  'has_attic',
  'has_crawl_space',
  'has_yard',
  'has_shed'
];

function noFlags(): PropertyFeatureFlags {
  return {
    has_garage: false,
    has_basement: false,
    has_attic: false,
    has_crawl_space: false,
    has_yard: false,
    has_shed: false
  };
}

/**
 * Every flag, stated explicitly — false as well as true.
 *
 * Returning a complete record rather than only the true ones is deliberate:
 * a caller writing this to the property must be able to clear a flag when the
 * matching room is gone, not only set it.
 */
export function deriveHasFlags(
  rooms: ReadonlyArray<Pick<RoomDraft, 'room_type'>>
): PropertyFeatureFlags {
  const flags = noFlags();

  for (const room of rooms) {
    const flag = FLAG_BY_ROOM_TYPE[room.room_type];
    if (flag) {
      flags[flag] = true;
    }
  }

  return flags;
}
