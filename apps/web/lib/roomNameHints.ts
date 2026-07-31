import type { RoomType } from '@home-folder/shared';

/**
 * Presentation helpers for entering rooms: names are stored title-cased
 * ("master bedroom" → "Master Bedroom"), and a name that obviously contains a
 * room type ("Guest Bedroom") pre-selects that type — still editable.
 */

export function titleCaseName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// Checked in order — more specific phrases first so "dining room" doesn't
// match plain "room", and "living room" wins over "living".
const NAME_TYPE_HINTS: Array<{ keyword: string; type: RoomType }> = [
  { keyword: 'living room', type: 'living_room' },
  { keyword: 'family room', type: 'living_room' },
  { keyword: 'great room', type: 'living_room' },
  { keyword: 'dining room', type: 'dining_room' },
  { keyword: 'dining', type: 'dining_room' },
  { keyword: 'laundry', type: 'laundry_room' },
  { keyword: 'utility room', type: 'utility_room' },
  { keyword: 'crawl space', type: 'crawl_space' },
  { keyword: 'bedroom', type: 'bedroom' },
  { keyword: 'bed room', type: 'bedroom' },
  { keyword: 'nursery', type: 'bedroom' },
  { keyword: 'bathroom', type: 'bathroom' },
  { keyword: 'bath', type: 'bathroom' },
  { keyword: 'powder room', type: 'bathroom' },
  { keyword: 'kitchen', type: 'kitchen' },
  { keyword: 'office', type: 'office' },
  { keyword: 'study', type: 'office' },
  { keyword: 'den', type: 'office' },
  { keyword: 'garage', type: 'garage' },
  { keyword: 'basement', type: 'basement' },
  { keyword: 'attic', type: 'attic' },
  { keyword: 'closet', type: 'closet' },
  { keyword: 'pantry', type: 'closet' },
  { keyword: 'hallway', type: 'hallway' },
  { keyword: 'hall', type: 'hallway' },
  { keyword: 'entryway', type: 'entryway' },
  { keyword: 'entry', type: 'entryway' },
  { keyword: 'foyer', type: 'entryway' },
  { keyword: 'mudroom', type: 'entryway' },
  { keyword: 'yard', type: 'yard' },
  { keyword: 'shed', type: 'shed' },
  { keyword: 'patio', type: 'patio' },
  { keyword: 'deck', type: 'deck' }
];

/** Room type implied by a name, or null when nothing recognizable appears. */
export function inferRoomTypeFromName(name: string): RoomType | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  for (const hint of NAME_TYPE_HINTS) {
    if (normalized.includes(hint.keyword)) {
      return hint.type;
    }
  }
  return null;
}

/** Room types that commonly have a closet worth filing things under. */
export const CLOSET_PROMPT_TYPES: RoomType[] = ['bedroom', 'bathroom', 'office', 'entryway'];
