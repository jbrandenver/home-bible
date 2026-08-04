import { ROOM_TYPES } from '@home-folder/shared';
import { getSupabaseBrowserClient } from './supabase/client';
import { formatDataError } from './errors';

export type RoomDraft = {
  name: string;
  room_type: (typeof ROOM_TYPES)[number];
  floor_name: string;
};

/**
 * The detail columns a room has always had in the schema. They are optional
 * here on purpose: callers that only rename a room (the onboarding list, for
 * example) must not blank out counts someone recorded on the room's own page.
 */
export type RoomDetailInput = {
  outlet_count?: number | null;
  switch_count?: number | null;
  vent_count?: number | null;
  vent_type?: string | null;
  breaker_label?: string | null;
  has_plumbing?: boolean;
};

export type RoomUpdateInput = RoomDraft &
  RoomDetailInput & {
    notes?: string | null;
  };

export type FloorRow = {
  id: string;
  property_id: string;
  name: string;
  floor_number: number;
  sort_order: number;
};

export type RoomRow = {
  id: string;
  property_id: string;
  floor_id: string | null;
  name: string;
  room_type: string;
  sort_order: number;
  notes?: string | null;
  created_at?: string;
};

export type RoomWithFloor = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
  floor_id: string | null;
  notes?: string | null;
  /** Only loaded by getRoomById, which reads a single room in full. */
  property_id?: string;
  outlet_count?: number | null;
  switch_count?: number | null;
  vent_count?: number | null;
  vent_type?: string | null;
  breaker_label?: string | null;
  has_plumbing?: boolean;
};

export async function getFloorsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [] as FloorRow[];
  }

  const { data } = await supabase
    .from('floors')
    .select('id, property_id, name, floor_number, sort_order')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('floor_number', { ascending: true })
    .order('sort_order', { ascending: true });

  return (data ?? []) as FloorRow[];
}

export async function getRoomsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [] as RoomWithFloor[];
  }

  const [floors, rooms] = await Promise.all([
    getFloorsForProperty(propertyId),
    supabase
      .from('rooms')
      .select('id, property_id, floor_id, name, room_type, sort_order, notes')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
  ]);

  const floorMap = new Map(floors.map((floor) => [floor.id, floor.name]));

  return ((rooms.data ?? []) as RoomRow[]).map((room) => ({
    id: room.id,
    name: room.name,
    room_type: room.room_type,
    floor_name: room.floor_id ? floorMap.get(room.floor_id) || 'Unknown floor' : 'Unassigned',
    floor_id: room.floor_id,
    notes: room.notes || null
  }));
}

export async function getRoomById(roomId: string): Promise<RoomWithFloor | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data: room } = await supabase
    .from('rooms')
    .select(
      'id, property_id, floor_id, name, room_type, notes, outlet_count, switch_count, vent_count, vent_type, breaker_label, has_plumbing'
    )
    .eq('id', roomId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!room) {
    return null;
  }

  let floorName = 'Unassigned';
  if (room.floor_id) {
    const { data: floor } = await supabase
      .from('floors')
      .select('id, name')
      .eq('id', room.floor_id)
      .maybeSingle();

    floorName = floor?.name || 'Unknown floor';
  }

  return {
    id: room.id,
    name: room.name,
    room_type: room.room_type,
    floor_name: floorName,
    floor_id: room.floor_id,
    notes: room.notes || null,
    property_id: room.property_id,
    outlet_count: room.outlet_count ?? null,
    switch_count: room.switch_count ?? null,
    vent_count: room.vent_count ?? null,
    vent_type: room.vent_type || null,
    breaker_label: room.breaker_label || null,
    has_plumbing: Boolean(room.has_plumbing)
  };
}

async function getOrCreateFloorForProperty(propertyId: string, floorName: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const normalizedFloorName = floorName.trim() || 'Main Floor';
  const existingFloors = await getFloorsForProperty(propertyId);
  const existingFloor = existingFloors.find(
    (floor) => floor.name.trim().toLowerCase() === normalizedFloorName.toLowerCase()
  );

  if (existingFloor) {
    return existingFloor;
  }

  const nextFloorNumber =
    existingFloors.length > 0
      ? Math.max(...existingFloors.map((floor) => floor.floor_number || 0)) + 1
      : 0;

  const { data: createdFloor, error } = await supabase
    .from('floors')
    .insert({
      property_id: propertyId,
      name: normalizedFloorName,
      floor_number: nextFloorNumber,
      sort_order: nextFloorNumber
    })
    .select('id, property_id, name, floor_number, sort_order')
    .single();

  if (error || !createdFloor) {
    if (error && 'code' in error && error.code === '23505') {
      const refreshedFloors = await getFloorsForProperty(propertyId);
      const refreshedFloor = refreshedFloors.find(
        (floor) => floor.name.trim().toLowerCase() === normalizedFloorName.toLowerCase()
      );

      if (refreshedFloor) {
        return refreshedFloor;
      }
    }

    throw new Error(error?.message || 'Failed to create floor');
  }

  return createdFloor as FloorRow;
}

export async function createRoomsForProperty(propertyId: string, drafts: RoomDraft[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  if (drafts.length === 0) {
    return [] as RoomWithFloor[];
  }

  const existingFloors = await getFloorsForProperty(propertyId);
  const floorByLowerName = new Map(existingFloors.map((floor) => [floor.name.trim().toLowerCase(), floor]));

  const uniqueFloorNames = Array.from(
    new Set(
      drafts
        .map((draft) => draft.floor_name.trim())
        .filter((name) => name.length > 0)
    )
  );

  let nextFloorNumber =
    existingFloors.length > 0
      ? Math.max(...existingFloors.map((floor) => floor.floor_number || 0)) + 1
      : 0;

  for (const floorName of uniqueFloorNames) {
    const key = floorName.toLowerCase();
    if (floorByLowerName.has(key)) {
      continue;
    }

    const { data: createdFloor, error } = await supabase
      .from('floors')
      .insert({
        property_id: propertyId,
        name: floorName,
        floor_number: nextFloorNumber,
        sort_order: nextFloorNumber
      })
      .select('id, property_id, name, floor_number, sort_order')
      .single();

    if (error || !createdFloor) {
      if (error && 'code' in error && error.code === '23505') {
        const refreshedFloors = await getFloorsForProperty(propertyId);
        const refreshedFloor = refreshedFloors.find(
          (floor) => floor.name.trim().toLowerCase() === floorName.toLowerCase()
        );

        if (refreshedFloor) {
          floorByLowerName.set(key, refreshedFloor);
          continue;
        }
      }

      throw new Error(error?.message || 'Failed to create floor');
    }

    floorByLowerName.set(key, createdFloor as FloorRow);
    nextFloorNumber += 1;
  }

  const { data: existingRooms } = await supabase
    .from('rooms')
    .select('id, property_id, floor_id, name, room_type, sort_order, notes')
    .eq('property_id', propertyId)
    .is('deleted_at', null);

  const duplicateKey = (name: string, roomType: string, floorId: string | null) =>
    `${name.trim().toLowerCase()}::${roomType}::${floorId || 'null'}`;

  const existingKeys = new Set(
    ((existingRooms ?? []) as RoomRow[]).map((room) => duplicateKey(room.name, room.room_type, room.floor_id || null))
  );

  const pendingRows: Array<{ property_id: string; floor_id: string | null; name: string; room_type: string; sort_order: number }> = [];

  for (const draft of drafts) {
    const floor = floorByLowerName.get((draft.floor_name.trim() || 'Main Floor').toLowerCase());
    const floorId = floor?.id || null;
    const key = duplicateKey(draft.name, draft.room_type, floorId);

    if (existingKeys.has(key)) {
      continue;
    }

    existingKeys.add(key);
    pendingRows.push({
      property_id: propertyId,
      floor_id: floorId,
      name: draft.name.trim(),
      room_type: draft.room_type,
      sort_order: 0
    });
  }

  for (const row of pendingRows) {
    const { error } = await supabase.from('rooms').insert(row);
    if (error && (!('code' in error) || error.code !== '23505')) {
      throw new Error(error.message || 'Failed to create rooms');
    }
  }

  return getRoomsForProperty(propertyId);
}

export async function updateRoomForProperty(propertyId: string, roomId: string, input: RoomUpdateInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('Room or space name is required.');
  }

  const floor = await getOrCreateFloorForProperty(propertyId, input.floor_name);

  const update: Record<string, unknown> = {
    name,
    room_type: input.room_type,
    floor_id: floor.id,
    notes: input.notes?.trim() || null
  };

  // Detail columns are written only when the caller offers them, so a form that
  // does not show outlet or vent counts cannot quietly erase them.
  if (input.outlet_count !== undefined) {
    update.outlet_count = input.outlet_count;
  }
  if (input.switch_count !== undefined) {
    update.switch_count = input.switch_count;
  }
  if (input.vent_count !== undefined) {
    update.vent_count = input.vent_count;
  }
  if (input.vent_type !== undefined) {
    update.vent_type = input.vent_type?.trim() || null;
  }
  if (input.breaker_label !== undefined) {
    update.breaker_label = input.breaker_label?.trim() || null;
  }
  if (input.has_plumbing !== undefined) {
    update.has_plumbing = input.has_plumbing;
  }

  const { error } = await supabase
    .from('rooms')
    .update(update)
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatDataError('save this room', error.message || ''));
  }

  return getRoomsForProperty(propertyId);
}

export async function deleteRoomForProperty(propertyId: string, roomId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { error } = await supabase
    .from('rooms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatDataError('remove this room', error.message || ''));
  }

  // Release anything still pointing at the room. The foreign keys are
  // `on delete set null`, which never fires for a soft delete, so without this
  // a deleted room leaves utilities, repairs and assets showing "Unknown room"
  // — and the service call sheet silently resolves their location to nothing.
  await releaseRoomReferences(propertyId, roomId);

  return getRoomsForProperty(propertyId);
}

/** Null out room_id on every record that referenced a removed room. */
async function releaseRoomReferences(propertyId: string, roomId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const dependents = ['utilities', 'assets', 'repairs', 'reminders', 'service_records', 'issues'];

  await Promise.all(
    dependents.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .update({ room_id: null })
        .eq('property_id', propertyId)
        .eq('room_id', roomId)
        .is('deleted_at', null);

      if (error) {
        // The room itself is already gone; a failure here leaves a stale
        // reference rather than corrupting anything, and the UI degrades to
        // "Room was deleted" rather than a hard error.
        console.warn(`Could not release ${table}.room_id for a deleted room:`, error.message);
      }
    })
  );
}
