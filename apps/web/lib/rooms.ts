import { ROOM_TYPES } from '@home-bible/shared';
import { getSupabaseBrowserClient } from './supabase/client';

export type RoomDraft = {
  name: string;
  room_type: (typeof ROOM_TYPES)[number];
  floor_name: string;
};

export type RoomUpdateInput = RoomDraft & {
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
    .select('id, property_id, floor_id, name, room_type, notes')
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
    notes: room.notes || null
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

  if (pendingRows.length > 0) {
    const { error } = await supabase.from('rooms').insert(pendingRows);
    if (error) {
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

  const { error } = await supabase
    .from('rooms')
    .update({
      name,
      room_type: input.room_type,
      floor_id: floor.id,
      notes: input.notes?.trim() || null
    })
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message || 'Failed to update room or space.');
  }

  return getRoomsForProperty(propertyId);
}
