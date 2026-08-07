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

export type PendingRoomRow = {
  property_id: string;
  floor_id: string | null;
  name: string;
  room_type: string;
  sort_order: number;
};

/** The floor a draft lands on when it names none. Matches getOrCreateFloorForProperty. */
export const DEFAULT_FLOOR_NAME = 'Main Floor';

/**
 * Which of these drafts are actually new rows, and what they look like on the
 * wire. Pure so it can be tested without a database: the duplicate rule here
 * has to match migration 015's partial unique index on
 * (property_id, floor, lower(trim(name)), room_type) exactly, or a bulk insert
 * of a generated starter set fails as a whole.
 *
 * Drafts are also deduplicated against each other, not just against what is
 * already stored — a starter set that offered "Bathroom" twice on one floor
 * would otherwise collapse in the database rather than here.
 */
export function planRoomInserts(
  propertyId: string,
  existingRooms: ReadonlyArray<Pick<RoomRow, 'name' | 'room_type' | 'floor_id'>>,
  drafts: ReadonlyArray<RoomDraft>,
  floorIdByLowerName: ReadonlyMap<string, string>
): PendingRoomRow[] {
  const duplicateKey = (name: string, roomType: string, floorId: string | null) =>
    `${name.trim().toLowerCase()}::${roomType}::${floorId || 'null'}`;

  const seenKeys = new Set(
    existingRooms.map((room) => duplicateKey(room.name, room.room_type, room.floor_id || null))
  );

  const pendingRows: PendingRoomRow[] = [];

  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) {
      continue;
    }

    const floorName = draft.floor_name.trim() || DEFAULT_FLOOR_NAME;
    const floorId = floorIdByLowerName.get(floorName.toLowerCase()) || null;
    const key = duplicateKey(name, draft.room_type, floorId);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    pendingRows.push({
      property_id: propertyId,
      floor_id: floorId,
      name,
      room_type: draft.room_type,
      sort_order: 0
    });
  }

  return pendingRows;
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

  const floorIdByLowerName = new Map(
    Array.from(floorByLowerName.entries()).map(([key, floor]) => [key, floor.id])
  );

  const pendingRows = planRoomInserts(
    propertyId,
    (existingRooms ?? []) as RoomRow[],
    drafts,
    floorIdByLowerName
  );

  if (pendingRows.length === 0) {
    return getRoomsForProperty(propertyId);
  }

  // One request, not one per room. Onboarding generates a whole starter set at
  // once, and a dozen sequential inserts is a visible stall on the wizard's
  // most important screen. Duplicates are already filtered above, so the array
  // insert succeeds outright in the normal case.
  const { error: batchError } = await supabase.from('rooms').insert(pendingRows);

  if (batchError) {
    const isDuplicate = 'code' in batchError && batchError.code === '23505';
    if (!isDuplicate) {
      throw new Error(batchError.message || 'Failed to create rooms');
    }

    // A genuine race — another tab or session inserted one of these between our
    // read and our write. An array insert is all-or-nothing, so fall back to a
    // row at a time and let the rest land.
    for (const row of pendingRows) {
      const { error } = await supabase.from('rooms').insert(row);
      if (error && (!('code' in error) || error.code !== '23505')) {
        throw new Error(error.message || 'Failed to create rooms');
      }
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

  // The name is needed after the delete: automation relationship rows keep a
  // human label once their room reference is released, and by then the room
  // row is soft-deleted.
  const { data: roomRow } = await supabase
    .from('rooms')
    .select('name')
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();

  const { data: deletedRows, error } = await supabase
    .from('rooms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    throw new Error(formatDataError('remove this room', error.message || ''));
  }

  // A soft delete that matches no row is a refusal, not a success: the room may
  // already be gone, belong to another property, or RLS may have filtered it.
  // Without this check the UI reported "removed" while the room stayed put.
  if (!deletedRows || deletedRows.length === 0) {
    throw new Error('This room could not be removed. It may already be gone, or you may not have permission.');
  }

  // Release anything still pointing at the room. The foreign keys are
  // `on delete set null`, which never fires for a soft delete, so without this
  // a deleted room leaves utilities, repairs and assets showing "Unknown room"
  // — and the service call sheet silently resolves their location to nothing.
  await releaseRoomReferences(propertyId, roomId, roomRow?.name || 'a removed room');

  return getRoomsForProperty(propertyId);
}

/**
 * Every table that links records to a room via a `room_id` column, with the
 * label the UI uses when telling a person what a room deletion touches.
 * `condition_report_entries` is deliberately absent: a condition report is a
 * point-in-time record, so its entries keep their room reference (editors can
 * still resolve soft-deleted room names under the 032 select policy).
 */
const ROOM_DEPENDENT_TABLES: ReadonlyArray<{ table: string; label: string }> = [
  { table: 'utilities', label: 'utilities' },
  { table: 'assets', label: 'appliances & belongings' },
  { table: 'repairs', label: 'repairs' },
  { table: 'reminders', label: 'reminders' },
  { table: 'service_records', label: 'service records' },
  { table: 'issues', label: 'issues' },
  { table: 'systems', label: 'home systems' },
  { table: 'documents', label: 'documents & photos' },
  { table: 'receipts', label: 'receipts' },
  { table: 'trend_flags', label: 'trend flags' },
  { table: 'automation_hubs', label: 'automation hubs' },
  { table: 'automation_devices', label: 'smart devices' }
];

export type RoomLinkCount = { label: string; count: number };

/**
 * How many active records still name this room, grouped for the delete
 * confirmation ("3 appliances & belongings, 1 document…"). A table whose count
 * cannot be read is skipped rather than failing the dialog — the confirmation
 * copy still warns that linked records stop naming the room.
 */
export async function getRoomLinkCounts(propertyId: string, roomId: string): Promise<RoomLinkCount[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const results = await Promise.all(
    ROOM_DEPENDENT_TABLES.map(async ({ table, label }) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('property_id', propertyId)
          .eq('room_id', roomId)
          .is('deleted_at', null);

        if (error || !count) {
          return null;
        }

        return { label, count } satisfies RoomLinkCount;
      } catch {
        return null;
      }
    })
  );

  return results.filter((entry): entry is RoomLinkCount => entry !== null);
}

/** Null out room_id on every record that referenced a removed room. */
async function releaseRoomReferences(propertyId: string, roomId: string, roomName: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  await Promise.all([
    ...ROOM_DEPENDENT_TABLES.map(async ({ table }) => {
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
    }),
    releaseReminderLinkTargets(propertyId, roomId),
    releaseAutomationRelationshipEndpoints(propertyId, roomId, roomName)
  ]);
}

/**
 * Reminders carry a second, FK-less reference: `linked_type`/`linked_id`. The
 * home map still resolves `linked_type === 'room'`, so a deleted room left a
 * dangling id there even after `room_id` was nulled. Those reminders fall back
 * to pointing at the property itself.
 */
async function releaseReminderLinkTargets(propertyId: string, roomId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('reminders')
    .update({ linked_type: 'property', linked_id: propertyId })
    .eq('property_id', propertyId)
    .eq('linked_type', 'room')
    .eq('linked_id', roomId)
    .is('deleted_at', null);

  if (error) {
    console.warn('Could not retarget reminder links for a deleted room:', error.message);
  }
}

/**
 * Automation relationships may name a room as either endpoint without a
 * foreign key. The uuid is released and the room's name is kept as the
 * endpoint label (when none was recorded) so the dependency map still reads
 * "Hub → Office" instead of an unlabeled hole.
 */
async function releaseAutomationRelationshipEndpoints(propertyId: string, roomId: string, roomName: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const { data: rows, error } = await supabase
    .from('automation_relationships')
    .select('id, source_type, source_id, source_label, target_type, target_id, target_label')
    .eq('property_id', propertyId)
    .or(`and(source_type.eq.room,source_id.eq.${roomId}),and(target_type.eq.room,target_id.eq.${roomId})`)
    .is('deleted_at', null);

  if (error || !rows || rows.length === 0) {
    if (error) {
      console.warn('Could not read automation relationships for a deleted room:', error.message);
    }
    return;
  }

  await Promise.all(
    rows.map(async (row) => {
      const update: Record<string, unknown> = {};
      if (row.source_type === 'room' && row.source_id === roomId) {
        update.source_id = null;
        update.source_label = row.source_label || roomName;
      }
      if (row.target_type === 'room' && row.target_id === roomId) {
        update.target_id = null;
        update.target_label = row.target_label || roomName;
      }

      const { error: updateError } = await supabase
        .from('automation_relationships')
        .update(update)
        .eq('id', row.id)
        .eq('property_id', propertyId);

      if (updateError) {
        console.warn('Could not release an automation relationship for a deleted room:', updateError.message);
      }
    })
  );
}
