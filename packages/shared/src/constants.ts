export const PROPERTY_TYPES = [
  'single_family_home',
  'condo',
  'apartment',
  'townhome',
  'duplex',
  'cabin',
  'rental_home'
] as const;

export const ROOM_TYPES = [
  'bedroom',
  'bathroom',
  'kitchen',
  'living_room',
  'dining_room',
  'office',
  'laundry_room',
  'garage',
  'basement',
  'attic',
  'crawl_space',
  'utility_room',
  'closet',
  'hallway',
  'entryway',
  'exterior',
  'yard',
  'shed',
  'patio',
  'deck',
  'other'
] as const;

export const UTILITY_TYPES = [
  'main_water_shutoff',
  'electrical_panel',
  'gas_shutoff',
  'water_heater',
  'hvac_unit',
  'furnace',
  'air_conditioner',
  'breaker_panel',
  'sump_pump',
  'irrigation_shutoff',
  'internet_modem',
  'router',
  'smoke_detector',
  'carbon_monoxide_detector',
  'other'
] as const;

export const MEMBER_ROLES = [
  'owner',
  'co_owner',
  'editor',
  'viewer',
  'maintenance_guest'
] as const;

export const PLAN_NAMES = ['free', 'pro', 'team'] as const;
