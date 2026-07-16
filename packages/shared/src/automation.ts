import { z } from 'zod';

// ===========================================================================
// Home Automation — shared constants, types, and validation
// Category / protocol / ecosystem are app-validated (expandable without a DB
// migration). Small stable sets mirror the DB CHECK constraints.
// ===========================================================================

export const AUTOMATION_DEVICE_CATEGORIES = [
  'lighting', 'switch', 'outlet', 'sensor', 'thermostat', 'hvac_control', 'camera',
  'doorbell', 'lock', 'garage_door', 'security_system', 'smoke_detector',
  'carbon_monoxide_detector', 'leak_detector', 'water_shutoff_valve', 'irrigation',
  'shades_blinds', 'fan', 'speaker', 'display', 'voice_assistant', 'appliance',
  'vacuum', 'air_quality', 'energy_monitor', 'solar', 'battery_storage', 'ev_charger',
  'network_equipment', 'hub', 'bridge', 'controller', 'thread_border_router',
  'custom', 'other'
] as const;

export const AUTOMATION_PROTOCOLS = [
  'wifi', 'ethernet', 'zigbee', 'zwave', 'thread', 'matter', 'bluetooth', 'ble',
  'rf', 'infrared', 'lora', 'cellular', 'proprietary', 'local_api', 'cloud_api', 'other'
] as const;

export const AUTOMATION_ECOSYSTEMS = [
  'apple_home', 'google_home', 'alexa', 'smartthings', 'home_assistant', 'hubitat',
  'aqara', 'hue', 'lutron', 'ring', 'nest', 'ecobee', 'shelly', 'tuya', 'other'
] as const;

export const AUTOMATION_DEVICE_STATUSES = [
  'online', 'offline', 'intermittent', 'needs_attention', 'low_battery',
  'updating', 'unconfigured', 'retired', 'unknown'
] as const;

export const AUTOMATION_POWER_TYPES = [
  'mains', 'battery', 'solar', 'poe', 'usb', 'hardwired', 'other'
] as const;

export const AUTOMATION_HUB_TYPES = [
  'smart_home_hub', 'bridge', 'matter_controller', 'thread_border_router',
  'security_controller', 'lighting_controller', 'hvac_controller',
  'irrigation_controller', 'local_automation_server', 'voice_assistant',
  'custom_controller', 'other'
] as const;

export const AUTOMATION_NETWORK_TYPES = [
  'wifi', 'ethernet', 'mesh', 'iot_vlan', 'guest', 'backup', 'other'
] as const;

export const AUTOMATION_ROUTINE_TYPES = [
  'routine', 'scene', 'schedule', 'rule', 'security', 'safety', 'energy',
  'climate', 'lighting', 'presence', 'accessibility', 'custom'
] as const;

export const AUTOMATION_ROUTINE_STATUSES = [
  'active', 'disabled', 'broken', 'untested', 'unknown'
] as const;

export const AUTOMATION_CRITICALITIES = ['low', 'normal', 'high', 'critical'] as const;

export const AUTOMATION_RELATIONSHIP_ENTITY_TYPES = [
  'device', 'hub', 'network', 'routine', 'cloud_service', 'ecosystem',
  'power_circuit', 'internet', 'room'
] as const;

export const AUTOMATION_RELATIONSHIP_TYPES = [
  'depends_on', 'controls', 'connects_to', 'bridges', 'member_of',
  'parent_of', 'powers', 'triggers', 'part_of', 'other'
] as const;

export const AUTOMATION_ROUTINE_DEVICE_ROLES = ['trigger', 'condition', 'action', 'involved'] as const;

export type AutomationDeviceCategory = (typeof AUTOMATION_DEVICE_CATEGORIES)[number];
export type AutomationProtocol = (typeof AUTOMATION_PROTOCOLS)[number];
export type AutomationEcosystem = (typeof AUTOMATION_ECOSYSTEMS)[number];
export type AutomationDeviceStatus = (typeof AUTOMATION_DEVICE_STATUSES)[number];
export type AutomationPowerType = (typeof AUTOMATION_POWER_TYPES)[number];
export type AutomationHubType = (typeof AUTOMATION_HUB_TYPES)[number];
export type AutomationNetworkType = (typeof AUTOMATION_NETWORK_TYPES)[number];
export type AutomationRoutineType = (typeof AUTOMATION_ROUTINE_TYPES)[number];
export type AutomationRoutineStatus = (typeof AUTOMATION_ROUTINE_STATUSES)[number];
export type AutomationCriticality = (typeof AUTOMATION_CRITICALITIES)[number];
export type AutomationRelationshipEntityType = (typeof AUTOMATION_RELATIONSHIP_ENTITY_TYPES)[number];
export type AutomationRelationshipType = (typeof AUTOMATION_RELATIONSHIP_TYPES)[number];
export type AutomationRoutineDeviceRole = (typeof AUTOMATION_ROUTINE_DEVICE_ROLES)[number];

// Homeowner-friendly labels — plain language first (spec design requirement).
export const AUTOMATION_STATUS_LABELS: Record<AutomationDeviceStatus, string> = {
  online: 'Working',
  offline: 'Not responding',
  intermittent: 'Drops out sometimes',
  needs_attention: 'Needs attention',
  low_battery: 'Low battery',
  updating: 'Updating',
  unconfigured: 'Not set up yet',
  retired: 'Retired',
  unknown: 'Not checked'
};

// ---------------------------------------------------------------------------
// Validation (reuses repo Zod convention). Nullable/optional to allow saving
// incomplete records and returning later (guided setup requirement).
// ---------------------------------------------------------------------------
const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalShort = z.string().trim().max(200).optional().nullable();
const optionalDate = z.string().trim().optional().nullable();
const optionalMoney = z.number().nonnegative().optional().nullable();

export const createAutomationDeviceSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required').max(200),
  nickname: optionalShort,
  category: z.enum(AUTOMATION_DEVICE_CATEGORIES).default('other'),
  status: z.enum(AUTOMATION_DEVICE_STATUSES).default('unknown'),
  manufacturer: optionalShort,
  model: optionalShort,
  serial_number: optionalShort,
  is_critical: z.boolean().default(false),
  indoor_outdoor: z.enum(['indoor', 'outdoor', 'both']).optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  floor_id: z.string().uuid().optional().nullable(),
  primary_hub_id: z.string().uuid().optional().nullable(),
  primary_network_id: z.string().uuid().optional().nullable(),
  primary_protocol: z.enum(AUTOMATION_PROTOCOLS).optional().nullable(),
  power_type: z.enum(AUTOMATION_POWER_TYPES).optional().nullable(),
  battery_type: optionalShort,
  internet_required: z.boolean().default(false),
  local_control_available: z.boolean().default(true),
  purchase_price: optionalMoney,
  warranty_expiration: optionalDate,
  // setup / recovery / handover documentation
  setup_instructions: optionalText,
  pairing_instructions: optionalText,
  reset_instructions: optionalText,
  troubleshooting_notes: optionalText,
  handover_notes: optionalText,
  notes: optionalText,
  // secure reference only — validated as a plain label, never a secret
  credential_reference: optionalShort,
  protocols: z.array(z.enum(AUTOMATION_PROTOCOLS)).optional(),
  ecosystems: z.array(z.enum(AUTOMATION_ECOSYSTEMS)).optional()
});

// Quick add: the minimum viable device (spec onboarding requirement).
export const quickAddAutomationDeviceSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required').max(200),
  category: z.enum(AUTOMATION_DEVICE_CATEGORIES).default('other'),
  room_id: z.string().uuid().optional().nullable(),
  primary_protocol: z.enum(AUTOMATION_PROTOCOLS).optional().nullable(),
  status: z.enum(AUTOMATION_DEVICE_STATUSES).default('unknown')
});

export const createAutomationHubSchema = z.object({
  name: z.string().trim().min(1, 'Hub name is required').max(200),
  hub_type: z.enum(AUTOMATION_HUB_TYPES).default('smart_home_hub'),
  manufacturer: optionalShort,
  model: optionalShort,
  room_id: z.string().uuid().optional().nullable(),
  network_id: z.string().uuid().optional().nullable(),
  local_control: z.boolean().default(true),
  cloud_dependency: z.boolean().default(false),
  internet_dependency: z.boolean().default(false),
  criticality: z.enum(AUTOMATION_CRITICALITIES).default('normal'),
  status: z.enum(AUTOMATION_DEVICE_STATUSES).default('unknown'),
  firmware_version: optionalShort,
  physical_location: optionalShort,
  backup_power: optionalShort,
  recovery_steps: optionalText,
  reset_instructions: optionalText,
  credential_reference: optionalShort,
  notes: optionalText
});

export const createAutomationNetworkSchema = z.object({
  name: z.string().trim().min(1, 'Network name is required').max(200),
  network_type: z.enum(AUTOMATION_NETWORK_TYPES).default('wifi'),
  ssid: optionalShort,
  internet_provider: optionalShort,
  is_guest: z.boolean().default(false),
  is_iot: z.boolean().default(false),
  physical_location: optionalShort,
  setup_instructions: optionalText,
  recovery_instructions: optionalText,
  credential_reference: optionalShort,
  notes: optionalText
});

export const createAutomationRoutineSchema = z.object({
  name: z.string().trim().min(1, 'Automation name is required').max(200),
  routine_type: z.enum(AUTOMATION_ROUTINE_TYPES).default('routine'),
  description: optionalText,
  platform: optionalShort,
  status: z.enum(AUTOMATION_ROUTINE_STATUSES).default('unknown'),
  criticality: z.enum(AUTOMATION_CRITICALITIES).default('normal'),
  trigger_text: optionalText,
  conditions_text: optionalText,
  actions_text: optionalText,
  internet_dependency: z.boolean().default(false),
  local_control_available: z.boolean().default(true),
  failure_behavior: optionalText,
  manual_override: optionalText,
  notes: optionalText
});

export type CreateAutomationDeviceInput = z.infer<typeof createAutomationDeviceSchema>;
export type QuickAddAutomationDeviceInput = z.infer<typeof quickAddAutomationDeviceSchema>;
export type CreateAutomationHubInput = z.infer<typeof createAutomationHubSchema>;
export type CreateAutomationNetworkInput = z.infer<typeof createAutomationNetworkSchema>;
export type CreateAutomationRoutineInput = z.infer<typeof createAutomationRoutineSchema>;
