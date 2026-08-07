// Writing rooms without caring whether there is an account behind them.
//
// `createRoomsForProperty` throws when Supabase is absent, and the demo path
// used to live inline in add-rooms.tsx — so any *new* caller (the onboarding
// starter set, most of all) would have written a signed-out visitor's rooms
// nowhere. This mirrors createUtilityForContext so both modes share one call
// site, and so the account-vs-demo decision is made in exactly one place.

import { resolveDataContext, type ResolvedDataContext } from './dataContext';
import { getDemoRooms, setDemoRooms, type DemoRoom } from './demoStorage';
import {
  DEFAULT_FLOOR_NAME,
  createRoomsForProperty,
  planRoomInserts,
  type RoomDraft,
  type RoomWithFloor
} from './rooms';

export type RoomDataContext = ResolvedDataContext;

/**
 * Resolve once, at the top of a flow. This is the only place the
 * account-vs-demo branch is allowed to be decided: `getCurrentUser` caches for
 * five seconds, and a stale `null` read inside a component would send a
 * signed-in person's rooms to localStorage. resolveDataContext already
 * confirms against the auth client before concluding "signed out".
 */
export async function getRoomDataContext(): Promise<RoomDataContext> {
  return resolveDataContext();
}

function demoRoomToRoomWithFloor(room: DemoRoom): RoomWithFloor {
  return {
    id: room.id,
    name: room.name,
    room_type: room.room_type,
    floor_name: room.floor_name,
    floor_id: null,
    notes: null
  };
}

/**
 * Demo storage keys rooms by floor *name*; the database keys them by floor id.
 * Feeding planRoomInserts a name-as-id map makes both modes apply the same
 * duplicate rule, so a starter set behaves identically before and after signup.
 */
function planDemoRoomInserts(existing: DemoRoom[], drafts: ReadonlyArray<RoomDraft>) {
  const floorNames = new Set<string>([DEFAULT_FLOOR_NAME]);
  for (const room of existing) {
    floorNames.add(room.floor_name.trim() || DEFAULT_FLOOR_NAME);
  }
  for (const draft of drafts) {
    floorNames.add(draft.floor_name.trim() || DEFAULT_FLOOR_NAME);
  }

  const floorIdByLowerName = new Map(
    Array.from(floorNames).map((name) => [name.toLowerCase(), name])
  );

  return planRoomInserts(
    'demo',
    existing.map((room) => ({
      name: room.name,
      room_type: room.room_type,
      floor_id: room.floor_name.trim() || DEFAULT_FLOOR_NAME
    })),
    drafts,
    floorIdByLowerName
  );
}

export async function createRoomsForContext(
  context: RoomDataContext,
  drafts: RoomDraft[]
): Promise<RoomWithFloor[]> {
  if (drafts.length === 0) {
    if (context.mode === 'demo') {
      return getDemoRooms().map(demoRoomToRoomWithFloor);
    }
    return context.property ? createRoomsForProperty(context.property.id, []) : [];
  }

  if (context.mode === 'demo') {
    const existing = getDemoRooms();
    const pending = planDemoRoomInserts(existing, drafts);

    const created: DemoRoom[] = pending.map((row) => ({
      id: crypto.randomUUID(),
      name: row.name,
      room_type: row.room_type,
      floor_name: row.floor_id || DEFAULT_FLOOR_NAME
    }));

    const next = [...existing, ...created];
    setDemoRooms(next);
    return next.map(demoRoomToRoomWithFloor);
  }

  if (!context.property) {
    // Signed in with no property yet. Deliberately not falling through to the
    // demo branch: adopting the localStorage property id here is what made an
    // earlier version send inserts Postgres rejected under RLS.
    throw new Error('Create a property before adding rooms.');
  }

  return createRoomsForProperty(context.property.id, drafts);
}
