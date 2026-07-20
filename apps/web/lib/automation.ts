import { formatDataError } from './errors';
// Home Automation data-access layer.
// Follows the existing lib idiom: getAutomationContext() resolves demo vs
// supabase; reads/writes go through the anon client under RLS. Like documents
// and receipts, automation data is Supabase-only — demo mode returns empty and
// writes prompt sign-in (avoids a large localStorage shadow model).

import {
  createAutomationDeviceSchema,
  createAutomationHubSchema,
  createAutomationNetworkSchema,
  createAutomationRoutineSchema,
  type AutomationCriticality,
  type AutomationDeviceCategory,
  type AutomationDeviceStatus,
  type AutomationEcosystem,
  type AutomationHubType,
  type AutomationNetworkType,
  type AutomationPowerType,
  type AutomationProtocol,
  type AutomationRoutineStatus,
  type AutomationRoutineType,
  type CreateAutomationDeviceInput,
  type CreateAutomationHubInput,
  type CreateAutomationNetworkInput,
  type CreateAutomationRoutineInput
} from '@home-folder/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const AUTOMATION_MIGRATION = 'supabase/migrations/012_home_automation.sql';

export type AutomationDataMode = 'demo' | 'supabase';

export type AutomationDataContext = {
  mode: AutomationDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

export type AutomationDeviceRow = {
  id: string;
  property_id: string;
  floor_id: string | null;
  room_id: string | null;
  primary_hub_id: string | null;
  primary_network_id: string | null;
  parent_device_id: string | null;
  name: string;
  nickname: string | null;
  category: AutomationDeviceCategory;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: AutomationDeviceStatus;
  is_critical: boolean;
  indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null;
  primary_protocol: AutomationProtocol | null;
  power_type: AutomationPowerType | null;
  battery_type: string | null;
  last_battery_replacement: string | null;
  circuit_reference: string | null;
  internet_required: boolean;
  local_control_available: boolean;
  firmware_version: string | null;
  warranty_expiration: string | null;
  purchase_price: number | null;
  setup_instructions: string | null;
  reset_instructions: string | null;
  troubleshooting_notes: string | null;
  handover_notes: string | null;
  credential_reference: string | null;
  notes: string | null;
  last_checked_date: string | null;
  retired_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AutomationHubRow = {
  id: string;
  property_id: string;
  room_id: string | null;
  network_id: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  hub_type: AutomationHubType;
  local_control: boolean;
  cloud_dependency: boolean;
  internet_dependency: boolean;
  criticality: AutomationCriticality;
  status: AutomationDeviceStatus;
  firmware_version: string | null;
  recovery_steps: string | null;
  reset_instructions: string | null;
  credential_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AutomationNetworkRow = {
  id: string;
  property_id: string;
  name: string;
  network_type: AutomationNetworkType;
  ssid: string | null;
  internet_provider: string | null;
  is_guest: boolean;
  is_iot: boolean;
  physical_location: string | null;
  recovery_instructions: string | null;
  credential_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AutomationRoutineRow = {
  id: string;
  property_id: string;
  name: string;
  routine_type: AutomationRoutineType;
  description: string | null;
  platform: string | null;
  status: AutomationRoutineStatus;
  criticality: AutomationCriticality;
  trigger_text: string | null;
  conditions_text: string | null;
  actions_text: string | null;
  internet_dependency: boolean;
  local_control_available: boolean;
  failure_behavior: string | null;
  manual_override: string | null;
  last_tested: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AutomationRelationshipRow = {
  id: string;
  property_id: string;
  source_type: string;
  source_id: string | null;
  source_label: string | null;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  relationship_type: string;
  is_required: boolean;
  is_primary: boolean;
  direction: string;
  description: string | null;
  failure_impact: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DeviceHubLink = { device_id: string; hub_id: string; is_required: boolean; is_primary: boolean };
export type DeviceNetworkLink = { device_id: string; network_id: string };
export type RoutineDeviceLink = { routine_id: string; device_id: string; role: string };

const RELATIONSHIP_SELECT =
  'id, property_id, source_type, source_id, source_label, target_type, target_id, target_label, relationship_type, is_required, is_primary, direction, description, failure_impact, created_at, updated_at, deleted_at';

const DEVICE_SELECT =
  'id, property_id, floor_id, room_id, primary_hub_id, primary_network_id, parent_device_id, name, nickname, category, manufacturer, model, serial_number, status, is_critical, indoor_outdoor, primary_protocol, power_type, battery_type, last_battery_replacement, circuit_reference, internet_required, local_control_available, firmware_version, warranty_expiration, purchase_price, setup_instructions, reset_instructions, troubleshooting_notes, handover_notes, credential_reference, notes, last_checked_date, retired_date, created_at, updated_at, deleted_at';

const HUB_SELECT =
  'id, property_id, room_id, network_id, name, manufacturer, model, hub_type, local_control, cloud_dependency, internet_dependency, criticality, status, firmware_version, recovery_steps, reset_instructions, credential_reference, notes, created_at, updated_at, deleted_at';

const NETWORK_SELECT =
  'id, property_id, name, network_type, ssid, internet_provider, is_guest, is_iot, physical_location, recovery_instructions, credential_reference, notes, created_at, updated_at, deleted_at';

const ROUTINE_SELECT =
  'id, property_id, name, routine_type, description, platform, status, criticality, trigger_text, conditions_text, actions_text, internet_dependency, local_control_available, failure_behavior, manual_override, last_tested, notes, created_at, updated_at, deleted_at';

function formatAutomationError(action: string, message?: string) {
  const detail = message || 'Unknown error';
  const lower = detail.toLowerCase();
  const needsMigration =
    lower.includes('does not exist') ||
    lower.includes('relation') ||
    lower.includes('column') ||
    lower.includes('schema cache');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${AUTOMATION_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

function firstZodMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'issues' in error) {
    const first = (error as { issues?: Array<{ message?: string }> }).issues?.[0];
    if (first?.message) return first.message;
  }
  return fallback;
}

export async function getAutomationContext(): Promise<AutomationDataContext> {
  const supabaseConfigured = isSupabaseConfigured();
  if (!supabaseConfigured) {
    return { mode: 'demo', supabaseConfigured, user: null, property: null };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { mode: 'demo', supabaseConfigured, user: null, property: null };
  }
  return {
    mode: 'supabase',
    supabaseConfigured,
    user,
    property: await getPrimaryPropertyForUser(user.id)
  };
}

function requireEditable(context: AutomationDataContext) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to manage smart home records. Demo mode does not persist automation data.');
  }
  if (!context.property) {
    throw new Error('Create or select a property before adding smart home records.');
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }
  return { supabase, property: context.property, user: context.user };
}

// ---------------------------------------------------------------------------
// DEVICES
// ---------------------------------------------------------------------------
export async function getDevicesForContext(context: AutomationDataContext): Promise<AutomationDeviceRow[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('automation_devices')
    .select(DEVICE_SELECT)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw new Error(formatAutomationError('load devices', error.message));
  return (data ?? []) as AutomationDeviceRow[];
}

export async function getDeviceById(
  context: AutomationDataContext,
  deviceId: string
): Promise<AutomationDeviceRow | null> {
  if (context.mode === 'demo' || !context.property) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('automation_devices')
    .select(DEVICE_SELECT)
    .eq('id', deviceId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(formatAutomationError('load device', error.message));
  return (data as AutomationDeviceRow) ?? null;
}

export async function createDeviceForContext(
  context: AutomationDataContext,
  input: CreateAutomationDeviceInput
): Promise<AutomationDeviceRow> {
  const { supabase, property, user } = requireEditable(context);

  const parsed = createAutomationDeviceSchema.safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Device details are invalid.'));
  const value = parsed.data;

  const { protocols, ecosystems, ...deviceFields } = value;

  const { data, error } = await supabase
    .from('automation_devices')
    .insert({ ...deviceFields, property_id: property.id, created_by: user?.id ?? null })
    .select(DEVICE_SELECT)
    .single();

  if (error) throw new Error(formatAutomationError('save device', error.message));
  const device = data as AutomationDeviceRow;

  // Junction rows (protocols / ecosystems) — best-effort, non-fatal.
  if (protocols && protocols.length > 0) {
    await supabase.from('automation_device_protocols').insert(
      protocols.map((protocol, index) => ({
        property_id: property.id,
        device_id: device.id,
        protocol,
        is_primary: index === 0
      }))
    );
  }
  if (ecosystems && ecosystems.length > 0) {
    await supabase.from('automation_device_ecosystems').insert(
      ecosystems.map((ecosystem) => ({ property_id: property.id, device_id: device.id, ecosystem }))
    );
  }

  return device;
}

export async function updateDeviceForContext(
  context: AutomationDataContext,
  deviceId: string,
  input: Partial<CreateAutomationDeviceInput>
): Promise<AutomationDeviceRow | null> {
  const { supabase, property } = requireEditable(context);

  const parsed = createAutomationDeviceSchema.partial().safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Device details are invalid.'));
  const { protocols, ecosystems, ...fields } = parsed.data;
  void protocols;
  void ecosystems;

  const { data, error } = await supabase
    .from('automation_devices')
    .update(fields)
    .eq('id', deviceId)
    .eq('property_id', property.id)
    .select(DEVICE_SELECT)
    .maybeSingle();

  if (error) throw new Error(formatAutomationError('update device', error.message));
  return (data as AutomationDeviceRow) ?? null;
}

export async function updateDeviceStatusForContext(
  context: AutomationDataContext,
  deviceId: string,
  status: AutomationDeviceStatus
): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_devices')
    .update({ status, last_checked_date: new Date().toLocaleDateString('en-CA') })
    .eq('id', deviceId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('update device status', error.message));
}

export async function deleteDeviceForContext(context: AutomationDataContext, deviceId: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_devices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', deviceId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('delete device', error.message));
}

// ---------------------------------------------------------------------------
// HUBS
// ---------------------------------------------------------------------------
export async function getHubsForContext(context: AutomationDataContext): Promise<AutomationHubRow[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_hubs')
    .select(HUB_SELECT)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw new Error(formatAutomationError('load hubs', error.message));
  return (data ?? []) as AutomationHubRow[];
}

export async function getHubById(context: AutomationDataContext, hubId: string): Promise<AutomationHubRow | null> {
  if (context.mode === 'demo' || !context.property) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('automation_hubs')
    .select(HUB_SELECT)
    .eq('id', hubId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('load hub', error.message));
  return (data as AutomationHubRow) ?? null;
}

export async function createHubForContext(
  context: AutomationDataContext,
  input: CreateAutomationHubInput
): Promise<AutomationHubRow> {
  const { supabase, property, user } = requireEditable(context);
  const parsed = createAutomationHubSchema.safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Hub details are invalid.'));
  const { data, error } = await supabase
    .from('automation_hubs')
    .insert({ ...parsed.data, property_id: property.id, created_by: user?.id ?? null })
    .select(HUB_SELECT)
    .single();
  if (error) throw new Error(formatAutomationError('save hub', error.message));
  return data as AutomationHubRow;
}

export async function updateHubForContext(
  context: AutomationDataContext,
  hubId: string,
  input: Partial<CreateAutomationHubInput>
): Promise<AutomationHubRow | null> {
  const { supabase, property } = requireEditable(context);
  const parsed = createAutomationHubSchema.partial().safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Hub details are invalid.'));
  const { data, error } = await supabase
    .from('automation_hubs')
    .update(parsed.data)
    .eq('id', hubId)
    .eq('property_id', property.id)
    .select(HUB_SELECT)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('update hub', error.message));
  return (data as AutomationHubRow) ?? null;
}

export async function deleteHubForContext(context: AutomationDataContext, hubId: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_hubs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', hubId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('delete hub', error.message));
}

// ---------------------------------------------------------------------------
// NETWORKS
// ---------------------------------------------------------------------------
export async function getNetworksForContext(context: AutomationDataContext): Promise<AutomationNetworkRow[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_networks')
    .select(NETWORK_SELECT)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw new Error(formatAutomationError('load networks', error.message));
  return (data ?? []) as AutomationNetworkRow[];
}

export async function createNetworkForContext(
  context: AutomationDataContext,
  input: CreateAutomationNetworkInput
): Promise<AutomationNetworkRow> {
  const { supabase, property, user } = requireEditable(context);
  const parsed = createAutomationNetworkSchema.safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Network details are invalid.'));
  const { data, error } = await supabase
    .from('automation_networks')
    .insert({ ...parsed.data, property_id: property.id, created_by: user?.id ?? null })
    .select(NETWORK_SELECT)
    .single();
  if (error) throw new Error(formatAutomationError('save network', error.message));
  return data as AutomationNetworkRow;
}

export async function getNetworkById(context: AutomationDataContext, networkId: string): Promise<AutomationNetworkRow | null> {
  if (context.mode === 'demo' || !context.property) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('automation_networks')
    .select(NETWORK_SELECT)
    .eq('id', networkId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('load network', error.message));
  return (data as AutomationNetworkRow) ?? null;
}

export async function updateNetworkForContext(
  context: AutomationDataContext,
  networkId: string,
  input: Partial<CreateAutomationNetworkInput>
): Promise<AutomationNetworkRow | null> {
  const { supabase, property } = requireEditable(context);
  const parsed = createAutomationNetworkSchema.partial().safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Network details are invalid.'));
  const { data, error } = await supabase
    .from('automation_networks')
    .update(parsed.data)
    .eq('id', networkId)
    .eq('property_id', property.id)
    .select(NETWORK_SELECT)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('update network', error.message));
  return (data as AutomationNetworkRow) ?? null;
}

export async function deleteNetworkForContext(context: AutomationDataContext, networkId: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_networks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', networkId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('delete network', error.message));
}

// ---------------------------------------------------------------------------
// ROUTINES (automations / scenes)
// ---------------------------------------------------------------------------
export async function getRoutinesForContext(context: AutomationDataContext): Promise<AutomationRoutineRow[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_routines')
    .select(ROUTINE_SELECT)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw new Error(formatAutomationError('load automations', error.message));
  return (data ?? []) as AutomationRoutineRow[];
}

export async function createRoutineForContext(
  context: AutomationDataContext,
  input: CreateAutomationRoutineInput
): Promise<AutomationRoutineRow> {
  const { supabase, property, user } = requireEditable(context);
  const parsed = createAutomationRoutineSchema.safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Automation details are invalid.'));
  const { data, error } = await supabase
    .from('automation_routines')
    .insert({ ...parsed.data, property_id: property.id, created_by: user?.id ?? null })
    .select(ROUTINE_SELECT)
    .single();
  if (error) throw new Error(formatAutomationError('save automation', error.message));
  return data as AutomationRoutineRow;
}

export async function deleteRoutineForContext(context: AutomationDataContext, routineId: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_routines')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', routineId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('delete automation', error.message));
}

export async function updateRoutineForContext(
  context: AutomationDataContext,
  routineId: string,
  input: Partial<CreateAutomationRoutineInput>
): Promise<AutomationRoutineRow | null> {
  const { supabase, property } = requireEditable(context);
  const parsed = createAutomationRoutineSchema.partial().safeParse(input);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error, 'Automation details are invalid.'));
  const { data, error } = await supabase
    .from('automation_routines')
    .update(parsed.data)
    .eq('id', routineId)
    .eq('property_id', property.id)
    .select(ROUTINE_SELECT)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('update automation', error.message));
  return (data as AutomationRoutineRow) ?? null;
}

export async function getRoutineById(context: AutomationDataContext, routineId: string): Promise<AutomationRoutineRow | null> {
  if (context.mode === 'demo' || !context.property) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('automation_routines')
    .select(ROUTINE_SELECT)
    .eq('id', routineId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatAutomationError('load automation', error.message));
  return (data as AutomationRoutineRow) ?? null;
}

// ---------------------------------------------------------------------------
// GRAPH LOADERS (for failure-impact + connection map)
// ---------------------------------------------------------------------------
export async function getRoutineDeviceLinksForContext(context: AutomationDataContext): Promise<RoutineDeviceLink[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_routine_devices')
    .select('routine_id, device_id, role')
    .eq('property_id', context.property.id);
  if (error) throw new Error(formatAutomationError('load automation links', error.message));
  return (data ?? []) as RoutineDeviceLink[];
}

export async function getDeviceHubLinksForContext(context: AutomationDataContext): Promise<DeviceHubLink[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_device_hubs')
    .select('device_id, hub_id, is_required, is_primary')
    .eq('property_id', context.property.id);
  if (error) throw new Error(formatAutomationError('load device-hub links', error.message));
  return (data ?? []) as DeviceHubLink[];
}

export type DeviceEcosystemLink = { device_id: string; ecosystem: string };

export async function getDeviceEcosystemLinksForContext(context: AutomationDataContext): Promise<DeviceEcosystemLink[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_device_ecosystems')
    .select('device_id, ecosystem')
    .eq('property_id', context.property.id);
  if (error) throw new Error(formatAutomationError('load device ecosystems', error.message));
  return (data ?? []) as DeviceEcosystemLink[];
}

export async function getDeviceNetworkLinksForContext(context: AutomationDataContext): Promise<DeviceNetworkLink[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_device_networks')
    .select('device_id, network_id')
    .eq('property_id', context.property.id);
  if (error) throw new Error(formatAutomationError('load device-network links', error.message));
  return (data ?? []) as DeviceNetworkLink[];
}

export async function getRelationshipsForContext(context: AutomationDataContext): Promise<AutomationRelationshipRow[]> {
  if (context.mode === 'demo' || !context.property) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('automation_relationships')
    .select(RELATIONSHIP_SELECT)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);
  if (error) throw new Error(formatAutomationError('load dependencies', error.message));
  return (data ?? []) as AutomationRelationshipRow[];
}

// ---------------------------------------------------------------------------
// ROUTINE ↔ DEVICE membership
// ---------------------------------------------------------------------------
export async function addRoutineDeviceForContext(
  context: AutomationDataContext,
  routineId: string,
  deviceId: string,
  role: 'trigger' | 'condition' | 'action' | 'involved'
): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_routine_devices')
    .upsert({ property_id: property.id, routine_id: routineId, device_id: deviceId, role }, { onConflict: 'routine_id,device_id,role' });
  if (error) throw new Error(formatAutomationError('link device to automation', error.message));
}

export async function removeRoutineDeviceForContext(
  context: AutomationDataContext,
  routineId: string,
  deviceId: string,
  role: string
): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_routine_devices')
    .delete()
    .eq('property_id', property.id)
    .eq('routine_id', routineId)
    .eq('device_id', deviceId)
    .eq('role', role);
  if (error) throw new Error(formatAutomationError('unlink device from automation', error.message));
}

export async function updateRoutineStatusForContext(
  context: AutomationDataContext,
  routineId: string,
  status: AutomationRoutineStatus
): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const patch: Record<string, unknown> = { status };
  if (status === 'active') patch.last_tested = new Date().toLocaleDateString('en-CA');
  const { error } = await supabase
    .from('automation_routines')
    .update(patch)
    .eq('id', routineId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('update automation status', error.message));
}

// ---------------------------------------------------------------------------
// RELATIONSHIPS (device dependencies incl. cloud services)
// ---------------------------------------------------------------------------
export async function createRelationshipForContext(
  context: AutomationDataContext,
  input: {
    source_type: string;
    source_id?: string | null;
    source_label?: string | null;
    target_type: string;
    target_id?: string | null;
    target_label?: string | null;
    relationship_type?: string;
    is_required?: boolean;
    description?: string | null;
    failure_impact?: string | null;
  }
): Promise<AutomationRelationshipRow> {
  const { supabase, property, user } = requireEditable(context);
  const { data, error } = await supabase
    .from('automation_relationships')
    .insert({
      property_id: property.id,
      created_by: user?.id ?? null,
      relationship_type: 'depends_on',
      is_required: true,
      ...input
    })
    .select(RELATIONSHIP_SELECT)
    .single();
  if (error) throw new Error(formatAutomationError('save dependency', error.message));
  return data as AutomationRelationshipRow;
}

export async function deleteRelationshipForContext(context: AutomationDataContext, relationshipId: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase
    .from('automation_relationships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', relationshipId)
    .eq('property_id', property.id);
  if (error) throw new Error(formatAutomationError('delete dependency', error.message));
}

// ---------------------------------------------------------------------------
// EXISTING-MODULE INTEGRATION — records linked to a device
// ---------------------------------------------------------------------------
export type LinkedRecord = { id: string; title: string; subtitle: string | null; href: string };
export type DeviceLinkedRecords = {
  documents: LinkedRecord[];
  issues: LinkedRecord[];
  repairs: LinkedRecord[];
  receipts: LinkedRecord[];
  serviceRecords: LinkedRecord[];
};

export async function getDeviceLinkedRecords(
  context: AutomationDataContext,
  deviceId: string
): Promise<DeviceLinkedRecords> {
  const empty: DeviceLinkedRecords = { documents: [], issues: [], repairs: [], receipts: [], serviceRecords: [] };
  if (context.mode === 'demo' || !context.property) return empty;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return empty;
  const pid = context.property.id;

  const [docs, issues, repairs, receipts, services] = await Promise.all([
    supabase.from('documents').select('id, title, document_type').eq('property_id', pid).eq('automation_device_id', deviceId).is('deleted_at', null),
    supabase.from('issues').select('id, title, status, severity').eq('property_id', pid).eq('automation_device_id', deviceId).is('deleted_at', null),
    supabase.from('repairs').select('id, title, status').eq('property_id', pid).eq('automation_device_id', deviceId).is('deleted_at', null),
    supabase.from('receipts').select('id, vendor_name, total_amount').eq('property_id', pid).eq('automation_device_id', deviceId).is('deleted_at', null),
    supabase.from('service_records').select('id, service_title, service_date').eq('property_id', pid).eq('automation_device_id', deviceId).is('deleted_at', null)
  ]);

  return {
    documents: (docs.data ?? []).map((d) => ({ id: d.id, title: d.title || 'Document', subtitle: d.document_type ?? null, href: `/documents?automationDeviceId=${deviceId}` })),
    issues: (issues.data ?? []).map((i) => ({ id: i.id, title: i.title || 'Issue', subtitle: [i.severity, i.status].filter(Boolean).join(' · ') || null, href: `/issues/${i.id}` })),
    repairs: (repairs.data ?? []).map((r) => ({ id: r.id, title: r.title || 'Repair', subtitle: r.status ?? null, href: `/repairs/${r.id}` })),
    receipts: (receipts.data ?? []).map((r) => ({ id: r.id, title: r.vendor_name || 'Receipt', subtitle: r.total_amount != null ? String(r.total_amount) : null, href: `/receipts` })),
    serviceRecords: (services.data ?? []).map((s) => ({ id: s.id, title: s.service_title || 'Service', subtitle: s.service_date ?? null, href: `/repairs` }))
  };
}

// Quick-create an issue or repair already linked to this device (round-trip
// integration without leaving the device). Minimal required fields; RLS applies.
export async function createIssueForDevice(context: AutomationDataContext, deviceId: string, title: string): Promise<void> {
  const { supabase, property, user } = requireEditable(context);
  const { error } = await supabase.from('issues').insert({
    property_id: property.id,
    automation_device_id: deviceId,
    title: title.trim() || 'Smart home issue',
    status: 'open',
    severity: 'medium'
  });
  if (error) throw new Error(formatAutomationError('report issue', error.message));
  void user;
}

export async function createRepairForDevice(context: AutomationDataContext, deviceId: string, title: string): Promise<void> {
  const { supabase, property } = requireEditable(context);
  const { error } = await supabase.from('repairs').insert({
    property_id: property.id,
    automation_device_id: deviceId,
    title: title.trim() || 'Smart home repair',
    status: 'open',
    priority: 'normal'
  });
  if (error) throw new Error(formatAutomationError('log repair', error.message));
}

// Distinct cloud services referenced by relationships (for failure-impact picker).
export function distinctCloudServices(relationships: AutomationRelationshipRow[]): string[] {
  const set = new Set<string>();
  for (const rel of relationships) {
    if (rel.deleted_at) continue;
    if (rel.target_type === 'cloud_service' && rel.target_label) set.add(rel.target_label);
  }
  return Array.from(set).sort();
}
