import { describe, expect, it } from 'vitest';
import { PROPERTY_TYPES, ROOM_TYPES, UTILITY_TYPES } from '@home-folder/shared';
import {
  STARTER_SPACE_CATALOG,
  STARTER_TEMPLATES,
  defaultSelectionFor,
  getStarterTemplate,
  offeredSpacesFor,
  offeredUtilitiesFor,
  utilityNameForType
} from '../lib/starterTemplates';

describe('STARTER_SPACE_CATALOG', () => {
  it('has unique keys', () => {
    const keys = STARTER_SPACE_CATALOG.map((space) => space.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // A new enum value is a three-place change (DB CHECK, zod, UI). The catalog
  // must never be the thing that forces one.
  it('only uses room types that already exist in the shared enum', () => {
    for (const space of STARTER_SPACE_CATALOG) {
      expect(ROOM_TYPES).toContain(space.room_type);
    }
  });

  it('gives counted spaces a usable ceiling and uncounted spaces a ceiling of one', () => {
    for (const space of STARTER_SPACE_CATALOG) {
      if (space.counted) {
        expect(space.max).toBeGreaterThan(1);
      } else {
        expect(space.max).toBe(1);
      }
    }
  });

  it('puts every outside space on the outside slot', () => {
    for (const space of STARTER_SPACE_CATALOG) {
      if (space.zone === 'outside') {
        expect(space.slot).toBe('outside');
      }
    }
  });
});

describe('STARTER_TEMPLATES', () => {
  it('covers every property type', () => {
    for (const type of PROPERTY_TYPES) {
      expect(STARTER_TEMPLATES[type]).toBeDefined();
    }
  });

  it('only references spaces that exist in the catalog', () => {
    const known = new Set(STARTER_SPACE_CATALOG.map((space) => space.key));
    for (const type of PROPERTY_TYPES) {
      for (const key of Object.keys(STARTER_TEMPLATES[type].spaces)) {
        expect(known, `${type} offers unknown space "${key}"`).toContain(key);
      }
    }
  });

  it('only uses utility types that already exist in the shared enum', () => {
    for (const type of PROPERTY_TYPES) {
      for (const utility of STARTER_TEMPLATES[type].utilities) {
        expect(UTILITY_TYPES).toContain(utility.utility_type);
      }
    }
  });

  it('never offers the same utility twice for one property type', () => {
    for (const type of PROPERTY_TYPES) {
      const types = STARTER_TEMPLATES[type].utilities.map((utility) => utility.utility_type);
      expect(new Set(types).size, `${type} repeats a utility`).toBe(types.length);
    }
  });

  it('never pre-ticks a count above the space ceiling', () => {
    for (const type of PROPERTY_TYPES) {
      for (const [key, count] of Object.entries(STARTER_TEMPLATES[type].spaces)) {
        const space = STARTER_SPACE_CATALOG.find((candidate) => candidate.key === key);
        expect(count).toBeLessThanOrEqual(space?.counted ? space.max : 1);
      }
    }
  });

  // Pre-ticking is a claim about someone's home. Too many wrong guesses and
  // un-ticking costs more than ticking would have.
  it('keeps the pre-ticked set modest for every property type', () => {
    for (const type of PROPERTY_TYPES) {
      const ticked = Object.values(STARTER_TEMPLATES[type].spaces).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(ticked, `${type} pre-ticks too much`).toBeLessThanOrEqual(14);
      expect(ticked, `${type} pre-ticks nothing`).toBeGreaterThan(0);
    }
  });

  it('gives every property type a sane default floor count', () => {
    for (const type of PROPERTY_TYPES) {
      expect(getStarterTemplate(type).defaultFloorCount).toBeGreaterThanOrEqual(1);
      expect(getStarterTemplate(type).defaultFloorCount).toBeLessThanOrEqual(4);
    }
  });
});

describe('property-type judgement calls', () => {
  it('hides spaces a flat cannot have', () => {
    for (const type of ['condo', 'apartment'] as const) {
      const offered = offeredSpacesFor(type).map((space) => space.key);
      expect(offered).not.toContain('yard');
      expect(offered).not.toContain('shed');
      expect(offered).not.toContain('attic');
      expect(offered).not.toContain('crawl_space');
      expect(offered).not.toContain('basement');
    }
  });

  it('offers a house the full outdoor set', () => {
    const offered = offeredSpacesFor('single_family_home').map((space) => space.key);
    expect(offered).toEqual(expect.arrayContaining(['yard', 'garage', 'shed', 'basement', 'attic']));
  });

  // A building is not a dwelling: its bedrooms and kitchens belong to the
  // units inside it.
  it('does not offer bedrooms or kitchens on building shells', () => {
    for (const type of ['apartment_building', 'multi_family'] as const) {
      const offered = offeredSpacesFor(type).map((space) => space.key);
      expect(offered).not.toContain('bedroom');
      expect(offered).not.toContain('kitchen');
    }
  });

  // welcome.tsx argues that finding the shut-off is worth five minutes.
  // Claiming a fourth-floor renter has one would make that promise a lie.
  it('does not assume a flat has a main water shut-off', () => {
    for (const type of ['condo', 'apartment'] as const) {
      const water = STARTER_TEMPLATES[type].utilities.find(
        (utility) => utility.utility_type === 'main_water_shutoff'
      );
      expect(water?.checked).toBe(false);
    }
  });

  it('does assume a house has one', () => {
    const water = STARTER_TEMPLATES.single_family_home.utilities.find(
      (utility) => utility.utility_type === 'main_water_shutoff'
    );
    expect(water?.checked).toBe(true);
  });
});

describe('offeredUtilitiesFor', () => {
  it('drops a sump pump when there is no basement', () => {
    const selection = { ...defaultSelectionFor('single_family_home'), basement: 0 };
    const types = offeredUtilitiesFor('single_family_home', selection).map((u) => u.utility_type);
    expect(types).not.toContain('sump_pump');
  });

  it('offers a sump pump once a basement is ticked', () => {
    const selection = { ...defaultSelectionFor('single_family_home'), basement: 1 };
    const types = offeredUtilitiesFor('single_family_home', selection).map((u) => u.utility_type);
    expect(types).toContain('sump_pump');
  });

  it('drops irrigation when there is no yard', () => {
    const selection = { ...defaultSelectionFor('single_family_home'), yard: 0 };
    const types = offeredUtilitiesFor('single_family_home', selection).map((u) => u.utility_type);
    expect(types).not.toContain('irrigation_shutoff');
  });
});

describe('utilityNameForType', () => {
  // These two strings are load-bearing: welcome.tsx's water and electrical
  // steps write exactly these. A mismatch means two rows for one shut-off.
  it('matches the names the welcome wizard already writes', () => {
    expect(utilityNameForType('main_water_shutoff')).toBe('Main water shut-off');
    expect(utilityNameForType('electrical_panel')).toBe('Electrical panel');
  });

  it('names every utility type', () => {
    for (const type of UTILITY_TYPES) {
      expect(utilityNameForType(type).trim().length).toBeGreaterThan(0);
    }
  });
});

describe('defaultSelectionFor', () => {
  it('returns a copy, so editing the grid cannot mutate the template', () => {
    const selection = defaultSelectionFor('single_family_home');
    selection.bedroom = 99;
    expect(STARTER_TEMPLATES.single_family_home.spaces.bedroom).toBe(3);
  });
});
