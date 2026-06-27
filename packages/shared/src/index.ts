import { z } from 'zod';

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

export const ASSET_TYPES = [
  'appliance',
  'accessory',
  'smart_device',
  'tool',
  'fixture',
  'furniture',
  'electronics',
  'outdoor_equipment',
  'home_system_component',
  'other'
] as const;

export const VISIBILITY_OPTIONS = [
  'private',
  'family',
  'maintenance',
  'buyer_report'
] as const;

export const WARRANTY_STATUSES = [
  'active',
  'expiring_soon',
  'expired',
  'unknown'
] as const;

export const REMINDER_TYPES = [
  'general',
  'maintenance',
  'warranty',
  'filter_change',
  'inspection',
  'seasonal',
  'utility',
  'asset',
  'other'
] as const;

export const REMINDER_LINKED_TYPES = [
  'property',
  'room',
  'utility',
  'asset'
] as const;

export const REMINDER_STATUSES = [
  'open',
  'completed',
  'dismissed'
] as const;

export const REMINDER_FREQUENCIES = [
  'none',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom'
] as const;

export const REMINDER_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent'
] as const;

export const REMINDER_SOURCES = [
  'manual',
  'warranty',
  'asset',
  'utility',
  'system_suggestion'
] as const;

export const REPAIR_TYPES = [
  'general',
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'roof',
  'exterior',
  'interior',
  'smart_home',
  'utility',
  'other'
] as const;

export const REPAIR_STATUSES = [
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'deferred',
  'cancelled'
] as const;

export const REPAIR_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent'
] as const;

export const SERVICE_TYPES = [
  'maintenance',
  'repair',
  'inspection',
  'installation',
  'replacement',
  'cleaning',
  'tune_up',
  'warranty_service',
  'other'
] as const;

export const ISSUE_TYPES = [
  'leak',
  'flood',
  'fire',
  'mold',
  'pest',
  'storm_damage',
  'electrical_issue',
  'plumbing_issue',
  'hvac_issue',
  'structural_issue',
  'roof_issue',
  'appliance_issue',
  'security_issue',
  'other'
] as const;

export const ISSUE_STATUSES = [
  'open',
  'watching',
  'scheduled',
  'resolved',
  'archived'
] as const;

export const ISSUE_SEVERITIES = [
  'low',
  'medium',
  'high',
  'urgent'
] as const;

export const MEMBER_ROLES = [
  'owner',
  'co_owner',
  'editor',
  'viewer',
  'maintenance_guest'
] as const;

export const PLAN_NAMES = [
  'free',
  'paid',
  'extra_property'
] as const;

export const createPropertySchema = z.object({
  nickname: z.string().min(1, 'Property nickname is required'),
  property_type: z.enum(PROPERTY_TYPES),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  address_is_enabled: z.boolean().default(false),
  square_feet: z.coerce.number().optional().nullable(),
  year_built: z.coerce.number().optional().nullable(),
  floor_count: z.coerce.number().optional().nullable(),
  has_garage: z.boolean().default(false),
  has_basement: z.boolean().default(false),
  has_attic: z.boolean().default(false),
  has_crawl_space: z.boolean().default(false),
  has_yard: z.boolean().default(false),
  has_shed: z.boolean().default(false)
});

export const createFloorSchema = z.object({
  property_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Floor name is required'),
  floor_number: z.coerce.number(),
  sort_order: z.coerce.number().default(0)
});

export const createRoomSchema = z.object({
  property_id: z.string().uuid().optional(),
  floor_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Room name is required'),
  room_type: z.enum(ROOM_TYPES),
  sort_order: z.coerce.number().default(0),
  notes: z.string().optional().nullable(),
  outlet_count: z.coerce.number().optional().nullable(),
  switch_count: z.coerce.number().optional().nullable(),
  vent_count: z.coerce.number().optional().nullable(),
  vent_type: z.string().optional().nullable(),
  breaker_label: z.string().optional().nullable(),
  has_plumbing: z.boolean().default(false)
});

export const createUtilitySchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  utility_type: z.enum(UTILITY_TYPES),
  name: z.string().min(1, 'Utility name is required'),
  location_notes: z.string().optional().nullable(),
  emergency_notes: z.string().optional().nullable()
});

export const createAssetSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_type: z.enum(ASSET_TYPES),
  name: z.string().min(1, 'Asset name is required'),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  retailer: z.string().optional().nullable(),
  warranty_length_months: z.coerce.number().optional().nullable(),
  warranty_expires_at: z.string().optional().nullable(),
  manual_url: z.string().url().optional().nullable(),
  support_url: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  visibility: z.enum(VISIBILITY_OPTIONS).default('private')
});

export const createReminderSchema = z.object({
  title: z.string().min(1, 'Reminder title is required'),
  description: z.string().optional().nullable(),
  reminder_type: z.enum(REMINDER_TYPES),
  due_date: z.string().optional().nullable(),
  linked_type: z.enum(REMINDER_LINKED_TYPES).optional().nullable(),
  linked_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  frequency: z.enum(REMINDER_FREQUENCIES).default('none'),
  repeat_rule: z.string().optional().nullable(),
  status: z.enum(REMINDER_STATUSES).default('open'),
  priority: z.enum(REMINDER_PRIORITIES).default('normal'),
  source: z.enum(REMINDER_SOURCES).default('manual')
});

export const createRepairSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Repair title is required'),
  description: z.string().optional().nullable(),
  repair_type: z.enum(REPAIR_TYPES).default('general'),
  status: z.enum(REPAIR_STATUSES).default('open'),
  priority: z.enum(REPAIR_PRIORITIES).default('normal'),
  reported_date: z.string().optional().nullable(),
  completed_date: z.string().optional().nullable(),
  contractor_name: z.string().optional().nullable(),
  contractor_phone: z.string().optional().nullable(),
  contractor_email: z.string().email().optional().nullable(),
  estimated_cost: z.coerce.number().optional().nullable(),
  actual_cost: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const createServiceRecordSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  service_type: z.enum(SERVICE_TYPES),
  service_title: z.string().min(1, 'Service title is required'),
  service_date: z.string().optional().nullable(),
  provider_name: z.string().optional().nullable(),
  provider_phone: z.string().optional().nullable(),
  provider_email: z.string().email().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  summary: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  next_service_date: z.string().optional().nullable()
});

export const createIssueSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  issue_type: z.enum(ISSUE_TYPES),
  title: z.string().min(1, 'Issue title is required'),
  description: z.string().optional().nullable(),
  status: z.enum(ISSUE_STATUSES).default('open'),
  severity: z.enum(ISSUE_SEVERITIES).default('medium'),
  date_found: z.string(),
  resolution_date: z.string().optional().nullable(),
  private_notes: z.string().optional().nullable(),
  shareable_notes: z.string().optional().nullable(),
  visibility: z.enum(VISIBILITY_OPTIONS).default('private')
});

export type PropertyType = typeof PROPERTY_TYPES[number];
export type RoomType = typeof ROOM_TYPES[number];
export type UtilityType = typeof UTILITY_TYPES[number];
export type AssetType = typeof ASSET_TYPES[number];
export type VisibilityOption = typeof VISIBILITY_OPTIONS[number];
export type WarrantyStatus = typeof WARRANTY_STATUSES[number];
export type ReminderType = typeof REMINDER_TYPES[number];
export type ReminderLinkedType = typeof REMINDER_LINKED_TYPES[number];
export type ReminderStatus = typeof REMINDER_STATUSES[number];
export type ReminderFrequency = typeof REMINDER_FREQUENCIES[number];
export type ReminderPriority = typeof REMINDER_PRIORITIES[number];
export type ReminderSource = typeof REMINDER_SOURCES[number];
export type RepairType = typeof REPAIR_TYPES[number];
export type RepairStatus = typeof REPAIR_STATUSES[number];
export type RepairPriority = typeof REPAIR_PRIORITIES[number];
export type ServiceType = typeof SERVICE_TYPES[number];
export type IssueType = typeof ISSUE_TYPES[number];
export type IssueStatus = typeof ISSUE_STATUSES[number];
export type IssueSeverity = typeof ISSUE_SEVERITIES[number];
export type MemberRole = typeof MEMBER_ROLES[number];
export type PlanName = typeof PLAN_NAMES[number];

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateUtilityInput = z.infer<typeof createUtilitySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type CreateServiceRecordInput = z.infer<typeof createServiceRecordSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export type DbRole = MemberRole;
export type DbVisibility = VisibilityOption;

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HouseholdRow {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PropertyRow {
  id: string;
  household_id: string;
  owner_user_id: string;
  nickname: string;
  property_type: PropertyType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RoomRow {
  id: string;
  property_id: string;
  floor_id: string | null;
  name: string;
  room_type: RoomType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UtilityRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_type: UtilityType;
  name: string;
  visibility: VisibilityOption;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AssetRow {
  id: string;
  property_id: string;
  room_id: string | null;
  asset_type: AssetType;
  name: string;
  visibility: VisibilityOption;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ReminderRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  reminder_type: ReminderType;
  due_date: string | null;
  linked_type: ReminderLinkedType | null;
  linked_id: string | null;
  repeat_rule: string | null;
  frequency: ReminderFrequency;
  status: ReminderStatus;
  priority: ReminderPriority;
  source: ReminderSource;
  visibility: VisibilityOption;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RepairRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  repair_type: RepairType;
  status: RepairStatus;
  priority: RepairPriority;
  reported_date: string | null;
  completed_date: string | null;
  contractor_name: string | null;
  contractor_phone: string | null;
  contractor_email: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceRecordRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  service_type: ServiceType;
  service_title: string;
  service_date: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  provider_email: string | null;
  cost: number | null;
  summary: string | null;
  notes: string | null;
  next_service_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface IssueRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  issue_type: IssueType;
  title: string;
  status: IssueStatus;
  severity: IssueSeverity;
  date_found: string;
  resolution_date: string | null;
  visibility: VisibilityOption;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
