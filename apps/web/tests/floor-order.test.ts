import { describe, expect, it } from 'vitest';
import { FLOOR_SUGGESTIONS, isOutdoorArea, sortFloorNames } from '../lib/floorOrder';
import { inferRoomTypeFromName, titleCaseName } from '../lib/roomNameHints';

describe('sortFloorNames', () => {
  it('orders floors basement → main → upper → attic with outdoor areas last', () => {
    expect(
      sortFloorNames(['Second Floor', 'Outside', 'Basement', 'Main Floor', 'Attic'])
    ).toEqual(['Basement', 'Main Floor', 'Second Floor', 'Attic', 'Outside']);
  });

  it('keeps unfamiliar floor names together, alphabetical, above the attic', () => {
    const sorted = sortFloorNames(['Attic', 'Mezzanine', 'Basement', 'Annex']);
    expect(sorted).toEqual(['Basement', 'Annex', 'Mezzanine', 'Attic']);
  });

  it('recognises common synonyms', () => {
    expect(sortFloorNames(['Upstairs', 'Ground Floor', 'Cellar'])).toEqual([
      'Cellar',
      'Ground Floor',
      'Upstairs'
    ]);
  });

  it('orders the default suggestions the way they are declared', () => {
    expect(sortFloorNames([...FLOOR_SUGGESTIONS].reverse())).toEqual(FLOOR_SUGGESTIONS);
  });
});

describe('isOutdoorArea', () => {
  it('treats yards and outside as areas, not floors', () => {
    expect(isOutdoorArea('Outside')).toBe(true);
    expect(isOutdoorArea('Back Yard')).toBe(true);
    expect(isOutdoorArea('Main Floor')).toBe(false);
    expect(isOutdoorArea('Basement')).toBe(false);
  });
});

describe('titleCaseName', () => {
  it('capitalises each word and collapses stray whitespace', () => {
    expect(titleCaseName('  master   bedroom ')).toBe('Master Bedroom');
  });

  it('leaves existing capitals alone', () => {
    expect(titleCaseName('TV room')).toBe('TV Room');
  });
});

describe('inferRoomTypeFromName', () => {
  it('matches obvious names to their type', () => {
    expect(inferRoomTypeFromName('Guest bedroom')).toBe('bedroom');
    expect(inferRoomTypeFromName('kitchen')).toBe('kitchen');
    expect(inferRoomTypeFromName('Entry way')).toBe('entryway');
    expect(inferRoomTypeFromName('Half bath')).toBe('bathroom');
  });

  it('prefers the specific phrase over a shorter keyword', () => {
    expect(inferRoomTypeFromName('Dining room')).toBe('dining_room');
    expect(inferRoomTypeFromName('Living Room')).toBe('living_room');
  });

  it('returns null when nothing is recognisable', () => {
    expect(inferRoomTypeFromName('')).toBeNull();
    expect(inferRoomTypeFromName('The Snug')).toBeNull();
  });
});
