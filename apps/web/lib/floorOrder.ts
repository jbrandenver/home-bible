// Canonical floor ordering for anywhere rooms are grouped by floor:
// basement first, then main/first, upper floors, attic — and outdoor areas
// always last, because "Outside" is an area, not a floor (it exists so yard
// utilities have somewhere to live; see lib/locationPresets.ts).

const OUTDOOR_KEYWORDS = ['outside', 'outdoor', 'exterior', 'yard', 'grounds'];

export function isOutdoorArea(floorName: string): boolean {
  const name = floorName.trim().toLowerCase();
  return OUTDOOR_KEYWORDS.some((keyword) => name.includes(keyword));
}

function floorSortRank(floorName: string): number {
  const name = floorName.trim().toLowerCase();

  if (isOutdoorArea(name)) return 900;
  if (name.includes('crawl')) return 1;
  if (name.includes('basement') || name.includes('cellar') || name.includes('lower')) return 2;
  if (name.includes('main') || name.includes('ground') || name.includes('first') || name.includes('1st')) return 10;
  if (name.includes('second') || name.includes('2nd') || name.includes('upstairs') || name.includes('upper')) return 20;
  if (name.includes('third') || name.includes('3rd')) return 30;
  if (name.includes('fourth') || name.includes('4th')) return 40;
  if (name.includes('attic') || name.includes('loft')) return 100;

  // Unnamed-pattern floors sit between the upper floors and the attic,
  // alphabetical among themselves.
  return 60;
}

export function sortFloorNames(floorNames: string[]): string[] {
  return [...floorNames].sort(
    (a, b) => floorSortRank(a) - floorSortRank(b) || a.localeCompare(b)
  );
}

/** Starting options for the floor dropdown before a home has its own floors. */
export const FLOOR_SUGGESTIONS = [
  'Basement',
  'Main Floor',
  'Second Floor',
  'Third Floor',
  'Attic',
  'Outside'
];
