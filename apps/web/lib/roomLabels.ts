import { formatEnumLabel } from '@home-bible/shared';

export type RoomLocationLike = {
  name?: string | null;
  room_type?: string | null;
  floor_name?: string | null;
};

const roomTypeLabels: Record<string, string> = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  dining_room: 'Dining Room',
  office: 'Office',
  laundry_room: 'Laundry Room',
  utility_room: 'Utility Room',
  closet: 'Closet',
  garage: 'Garage',
  basement: 'Basement',
  attic: 'Attic',
  crawl_space: 'Crawl Space',
  hallway: 'Hallway',
  entryway: 'Entryway',
  exterior: 'Outdoor',
  yard: 'Yard',
  shed: 'Shed',
  patio: 'Patio',
  deck: 'Deck',
  other: 'Other'
};

const roomTypePluralLabels: Record<string, string> = {
  bedroom: 'Bedrooms',
  bathroom: 'Bathrooms',
  kitchen: 'Kitchens',
  living_room: 'Living Rooms',
  dining_room: 'Dining Rooms',
  office: 'Offices',
  laundry_room: 'Laundry Rooms',
  utility_room: 'Utility Rooms',
  closet: 'Closets',
  garage: 'Garages',
  basement: 'Basements',
  attic: 'Attics',
  crawl_space: 'Crawl Spaces',
  hallway: 'Hallways',
  entryway: 'Entryways',
  exterior: 'Outdoor Areas',
  yard: 'Yards',
  shed: 'Sheds',
  patio: 'Patios',
  deck: 'Decks',
  other: 'Other Spaces'
};

const dashboardTypeOrder = [
  'bedroom',
  'bathroom',
  'closet',
  'garage',
  'kitchen',
  'living_room',
  'dining_room',
  'office',
  'laundry_room',
  'utility_room',
  'basement',
  'attic',
  'crawl_space',
  'hallway',
  'entryway',
  'exterior',
  'yard',
  'shed',
  'patio',
  'deck',
  'other'
];

function cleanLabel(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatRoomTypeLabel(roomType?: string | null) {
  const value = cleanLabel(roomType);
  return roomTypeLabels[value] || formatEnumLabel(value || 'room');
}

export function formatRoomLocation(room: RoomLocationLike) {
  const roomName = cleanLabel(room.name) || formatRoomTypeLabel(room.room_type);
  const floorName = cleanLabel(room.floor_name);

  if (!floorName || floorName === 'Unassigned') {
    return roomName;
  }

  return `${floorName} · ${roomName}`;
}

export function formatRoomTypeCount(roomType: string, count: number) {
  const singular = formatRoomTypeLabel(roomType);
  const plural = roomTypePluralLabels[roomType] || `${singular}s`;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getRoomSpaceSummary(rooms: RoomLocationLike[]) {
  const counts = rooms.reduce<Record<string, number>>((acc, room) => {
    const roomType = cleanLabel(room.room_type) || 'other';
    acc[roomType] = (acc[roomType] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort(([typeA], [typeB]) => {
      const indexA = dashboardTypeOrder.indexOf(typeA);
      const indexB = dashboardTypeOrder.indexOf(typeB);
      const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      return normalizedA - normalizedB || formatRoomTypeLabel(typeA).localeCompare(formatRoomTypeLabel(typeB));
    })
    .map(([roomType, count]) => ({
      roomType,
      count,
      label: formatRoomTypeCount(roomType, count)
    }));
}
