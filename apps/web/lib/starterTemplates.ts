// What a home of a given kind usually contains.
//
// Onboarding used to ask people to type their rooms in one at a time. This is
// the data behind asking them to *un-tick what they do not have* instead —
// which is recognition rather than recall, and costs no typing at all.
//
// A plain TypeScript constant on purpose:
//   - not a database table, because that means a migration, an RLS policy and
//     a network read on the wizard's critical path — and demo mode, which runs
//     with no account at all, could not read it;
//   - not packages/shared, because that package is the database contract
//     (enums mirrored three ways, per D-4). These sets are a product opinion
//     that will be edited often, and they should feel safe to edit.
//
// It sits beside locationPresets.ts, floorOrder.ts and complianceTemplates.ts,
// which are the same kind of thing.
//
// Every room_type and utility_type below already exists in the shared enums.
// Keep it that way: a new enum value is a three-place change (DB CHECK, zod,
// UI), and 'other' plus 'entryway' already absorb the long tail.

import type { PropertyType, RoomType, UtilityType } from '@home-folder/shared';

/**
 * Where a space sits, expressed relative to the home rather than as a floor
 * name. One template then serves a bungalow and a three-storey: the name is
 * resolved later from the floor count the person gave us.
 */
export type FloorSlot = 'lower' | 'main' | 'upper' | 'top' | 'outside';

/** The six boolean columns properties has always carried. */
export type PropertyFeatureFlag =
  | 'has_garage'
  | 'has_basement'
  | 'has_attic'
  | 'has_crawl_space'
  | 'has_yard'
  | 'has_shed';

export type StarterSpace = {
  key: string;
  /** Singular. Counted spaces get numbered from this. */
  label: string;
  room_type: RoomType;
  zone: 'inside' | 'outside';
  slot: FloorSlot;
  /** Renders a stepper rather than a checkbox. */
  counted: boolean;
  /** Stepper ceiling. Ignored when `counted` is false. */
  max: number;
  /** Where instances after the first go, when that differs from `slot`. */
  overflowSlot?: FloorSlot;
  /** Ticking this space also sets this column on the property. */
  propertyFlag?: PropertyFeatureFlag;
};

/**
 * Every space any template can offer. The per-type sets below choose from
 * this list; nothing else may appear in the grid.
 */
export const STARTER_SPACE_CATALOG: ReadonlyArray<StarterSpace> = [
  { key: 'kitchen', label: 'Kitchen', room_type: 'kitchen', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'living_room', label: 'Living room', room_type: 'living_room', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'dining_room', label: 'Dining room', room_type: 'dining_room', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'entryway', label: 'Entryway', room_type: 'entryway', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'hallway', label: 'Hallway', room_type: 'hallway', zone: 'inside', slot: 'main', counted: false, max: 1 },
  // Bedrooms live upstairs when there is an upstairs; bathrooms usually start
  // on the main floor and the rest follow the bedrooms.
  { key: 'bedroom', label: 'Bedroom', room_type: 'bedroom', zone: 'inside', slot: 'upper', counted: true, max: 8 },
  { key: 'bathroom', label: 'Bathroom', room_type: 'bathroom', zone: 'inside', slot: 'main', counted: true, max: 6, overflowSlot: 'upper' },
  { key: 'office', label: 'Office', room_type: 'office', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'laundry_room', label: 'Laundry room', room_type: 'laundry_room', zone: 'inside', slot: 'lower', counted: false, max: 1 },
  { key: 'utility_room', label: 'Utility room', room_type: 'utility_room', zone: 'inside', slot: 'lower', counted: false, max: 1 },
  { key: 'closet', label: 'Closet', room_type: 'closet', zone: 'inside', slot: 'main', counted: false, max: 1 },
  { key: 'basement', label: 'Basement', room_type: 'basement', zone: 'inside', slot: 'lower', counted: false, max: 1, propertyFlag: 'has_basement' },
  { key: 'attic', label: 'Attic', room_type: 'attic', zone: 'inside', slot: 'top', counted: false, max: 1, propertyFlag: 'has_attic' },
  { key: 'crawl_space', label: 'Crawl space', room_type: 'crawl_space', zone: 'inside', slot: 'lower', counted: false, max: 1, propertyFlag: 'has_crawl_space' },
  { key: 'garage', label: 'Garage', room_type: 'garage', zone: 'outside', slot: 'outside', counted: false, max: 1, propertyFlag: 'has_garage' },
  { key: 'yard', label: 'Yard', room_type: 'yard', zone: 'outside', slot: 'outside', counted: false, max: 1, propertyFlag: 'has_yard' },
  { key: 'shed', label: 'Shed', room_type: 'shed', zone: 'outside', slot: 'outside', counted: false, max: 1, propertyFlag: 'has_shed' },
  { key: 'patio', label: 'Patio', room_type: 'patio', zone: 'outside', slot: 'outside', counted: false, max: 1 },
  { key: 'deck', label: 'Deck', room_type: 'deck', zone: 'outside', slot: 'outside', counted: false, max: 1 },
  { key: 'exterior', label: 'Exterior', room_type: 'exterior', zone: 'outside', slot: 'outside', counted: false, max: 1 }
];

const SPACE_BY_KEY = new Map(STARTER_SPACE_CATALOG.map((space) => [space.key, space]));

export function starterSpace(key: string): StarterSpace | undefined {
  return SPACE_BY_KEY.get(key);
}

/** Display name for a system, so nobody types what the type already says. */
const UTILITY_NAMES: Record<UtilityType, string> = {
  // These first two strings are load-bearing: welcome.tsx's water and
  // electrical steps already write exactly these names. If the systems grid
  // spelled them differently it would create a second copy of each.
  main_water_shutoff: 'Main water shut-off',
  electrical_panel: 'Electrical panel',
  gas_shutoff: 'Gas shut-off',
  water_heater: 'Water heater',
  hvac_unit: 'HVAC unit',
  furnace: 'Furnace',
  air_conditioner: 'Air conditioner',
  breaker_panel: 'Breaker panel',
  sump_pump: 'Sump pump',
  irrigation_shutoff: 'Irrigation shut-off',
  internet_modem: 'Internet modem',
  router: 'Router',
  smoke_detector: 'Smoke detector',
  carbon_monoxide_detector: 'Carbon monoxide detector',
  other: 'Other system'
};

export function utilityNameForType(type: UtilityType): string {
  return UTILITY_NAMES[type];
}

/**
 * Systems that have their own wizard step.
 *
 * The water and electrical steps capture a *location*, which is the whole
 * point of asking about them at all. The systems grid must not also offer
 * them, or a person would end up with two rows for one shut-off — one with
 * the location they went and found, and one without.
 */
export const DEDICATED_UTILITY_TYPES: ReadonlyArray<UtilityType> = [
  'main_water_shutoff',
  'electrical_panel'
];

export type StarterUtility = {
  utility_type: UtilityType;
  checked: boolean;
  /**
   * Only offered when the home has this. A sump pump in a home with no
   * basement, or irrigation with no yard, is noise.
   */
  requires?: 'basement' | 'yard';
};

export type StarterTemplate = {
  defaultFloorCount: number;
  /**
   * Space key → starting count. A key that is absent is not offered at all;
   * present with 0 is offered unticked; present with n > 0 starts ticked.
   * Hiding beats offering-unticked when a space cannot exist: a condo has no
   * crawl space, and making someone read past it is a small tax on everyone.
   */
  spaces: Record<string, number>;
  utilities: ReadonlyArray<StarterUtility>;
};

const HOUSE_UTILITIES: ReadonlyArray<StarterUtility> = [
  { utility_type: 'main_water_shutoff', checked: true },
  { utility_type: 'electrical_panel', checked: true },
  { utility_type: 'water_heater', checked: true },
  { utility_type: 'furnace', checked: true },
  { utility_type: 'smoke_detector', checked: true },
  { utility_type: 'carbon_monoxide_detector', checked: false },
  { utility_type: 'gas_shutoff', checked: false },
  { utility_type: 'air_conditioner', checked: false },
  { utility_type: 'router', checked: false },
  { utility_type: 'sump_pump', checked: false, requires: 'basement' },
  { utility_type: 'irrigation_shutoff', checked: false, requires: 'yard' }
];

const FLAT_UTILITIES: ReadonlyArray<StarterUtility> = [
  { utility_type: 'electrical_panel', checked: true },
  { utility_type: 'water_heater', checked: true },
  { utility_type: 'smoke_detector', checked: true },
  { utility_type: 'carbon_monoxide_detector', checked: false },
  // Deliberately unticked for flats. welcome.tsx's whole argument is that
  // finding the shut-off is worth five minutes; telling a fourth-floor renter
  // theirs exists when it does not turns that promise into a lie.
  { utility_type: 'main_water_shutoff', checked: false },
  { utility_type: 'router', checked: false }
];

const BUILDING_UTILITIES: ReadonlyArray<StarterUtility> = [
  { utility_type: 'main_water_shutoff', checked: true },
  { utility_type: 'electrical_panel', checked: true },
  { utility_type: 'water_heater', checked: true },
  { utility_type: 'furnace', checked: true },
  { utility_type: 'smoke_detector', checked: true },
  { utility_type: 'carbon_monoxide_detector', checked: true },
  { utility_type: 'gas_shutoff', checked: false },
  { utility_type: 'sump_pump', checked: false, requires: 'basement' }
];

const HOUSE_SPACES: Record<string, number> = {
  kitchen: 1,
  living_room: 1,
  dining_room: 1,
  entryway: 1,
  bedroom: 3,
  bathroom: 2,
  laundry_room: 1,
  garage: 1,
  yard: 1,
  basement: 0,
  attic: 0,
  crawl_space: 0,
  office: 0,
  utility_room: 0,
  hallway: 0,
  shed: 0,
  patio: 0,
  deck: 0
};

export const STARTER_TEMPLATES: Record<PropertyType, StarterTemplate> = {
  single_family_home: {
    defaultFloorCount: 2,
    spaces: HOUSE_SPACES,
    utilities: HOUSE_UTILITIES
  },

  // Same physical shape as a house. The difference is who lives there, and
  // that is recorded on the tenancy, not the room list.
  rental_home: {
    defaultFloorCount: 2,
    spaces: HOUSE_SPACES,
    utilities: HOUSE_UTILITIES
  },

  townhome: {
    defaultFloorCount: 2,
    spaces: {
      kitchen: 1,
      living_room: 1,
      entryway: 1,
      bedroom: 3,
      bathroom: 2,
      laundry_room: 1,
      garage: 1,
      dining_room: 0,
      basement: 0,
      attic: 0,
      office: 0,
      utility_room: 0,
      patio: 0,
      deck: 0,
      yard: 0
    },
    utilities: HOUSE_UTILITIES
  },

  duplex: {
    defaultFloorCount: 2,
    spaces: {
      kitchen: 1,
      living_room: 1,
      entryway: 1,
      bedroom: 2,
      bathroom: 1,
      laundry_room: 1,
      yard: 1,
      dining_room: 0,
      basement: 0,
      attic: 0,
      office: 0,
      utility_room: 0,
      garage: 0,
      shed: 0
    },
    utilities: HOUSE_UTILITIES
  },

  condo: {
    defaultFloorCount: 1,
    spaces: {
      kitchen: 1,
      living_room: 1,
      entryway: 1,
      bedroom: 2,
      bathroom: 2,
      laundry_room: 1,
      dining_room: 0,
      office: 0,
      closet: 0,
      utility_room: 0,
      garage: 0,
      patio: 0,
      deck: 0
    },
    utilities: FLAT_UTILITIES
  },

  apartment: {
    defaultFloorCount: 1,
    spaces: {
      kitchen: 1,
      living_room: 1,
      entryway: 1,
      bedroom: 1,
      bathroom: 1,
      dining_room: 0,
      office: 0,
      closet: 0,
      laundry_room: 0,
      utility_room: 0,
      patio: 0
    },
    utilities: FLAT_UTILITIES
  },

  cabin: {
    defaultFloorCount: 1,
    spaces: {
      kitchen: 1,
      living_room: 1,
      entryway: 1,
      bedroom: 2,
      bathroom: 1,
      yard: 1,
      shed: 1,
      dining_room: 0,
      attic: 0,
      crawl_space: 0,
      utility_room: 0,
      deck: 0,
      patio: 0,
      garage: 0
    },
    utilities: HOUSE_UTILITIES
  },

  // A building shell, not a dwelling. Bedrooms and kitchens belong to the
  // units inside it (properties.parent_property_id), so offering them here
  // would write rooms that are simply not true of the building — and the
  // people who own buildings are exactly the ones who would notice.
  multi_family: {
    defaultFloorCount: 2,
    spaces: {
      entryway: 1,
      utility_room: 1,
      laundry_room: 1,
      yard: 1,
      basement: 0,
      garage: 0,
      hallway: 0,
      shed: 0,
      exterior: 0
    },
    utilities: BUILDING_UTILITIES
  },

  apartment_building: {
    defaultFloorCount: 3,
    spaces: {
      entryway: 1,
      utility_room: 1,
      hallway: 1,
      basement: 0,
      laundry_room: 0,
      garage: 0,
      yard: 0,
      exterior: 0
    },
    utilities: BUILDING_UTILITIES
  }
};

export function getStarterTemplate(propertyType: PropertyType): StarterTemplate {
  return STARTER_TEMPLATES[propertyType] ?? STARTER_TEMPLATES.single_family_home;
}

/** A person's answers on the spaces step: space key → how many. */
export type SpaceSelection = Record<string, number>;

/** The grid's starting state for a kind of home. */
export function defaultSelectionFor(propertyType: PropertyType): SpaceSelection {
  return { ...getStarterTemplate(propertyType).spaces };
}

/**
 * The spaces to draw, in catalog order, filtered to what this kind of home can
 * have. Catalog order is deliberate: it reads roughly as a walk through a
 * house, and a stable order means the grid does not reshuffle as boxes change.
 */
export function offeredSpacesFor(propertyType: PropertyType): StarterSpace[] {
  const template = getStarterTemplate(propertyType);
  return STARTER_SPACE_CATALOG.filter((space) => space.key in template.spaces);
}

/**
 * The systems to offer, dropping any whose precondition the chosen spaces do
 * not meet.
 */
export function offeredUtilitiesFor(
  propertyType: PropertyType,
  selection: SpaceSelection
): StarterUtility[] {
  const has = (key: string) => (selection[key] ?? 0) > 0;

  return getStarterTemplate(propertyType).utilities.filter((utility) => {
    if (utility.requires === 'basement') return has('basement');
    if (utility.requires === 'yard') return has('yard');
    return true;
  });
}
