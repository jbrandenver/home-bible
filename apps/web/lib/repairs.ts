import {
  REPAIR_PRIORITIES,
  REPAIR_STATUSES,
  REPAIR_TYPES
} from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_REPAIRS_KEY = 'homeBible.repairs';
const PHASE_6F_MIGRATION = 'supabase/migrations/005_phase6f_repairs_service_records.sql';

export type RepairType = (typeof REPAIR_TYPES)[number];
export type RepairStatus = (typeof REPAIR_STATUSES)[number];
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];
export type RepairDataMode = 'demo' | 'supabase';

export type RepairRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
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
};

export type RepairInput = {
  title: string;
  description?: string | null;
  repair_type?: RepairType;
  status?: RepairStatus;
  priority?: RepairPriority;
  reported_date?: string | null;
  completed_date?: string | null;
  contractor_name?: string | null;
  contractor_phone?: string | null;
  contractor_email?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
  notes?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
};

export type RepairDataContext = {
  mode: RepairDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

const REPAIR_SELECT =
  'id, property_id, room_id, asset_id, utility_id, title, description, repair_type, status, priority, reported_date, completed_date, contractor_name, contractor_phone, contractor_email, estimated_cost, actual_cost, notes, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeRepair(raw: Partial<RepairRow>): RepairRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: nullableString(raw.room_id),
    asset_id: nullableString(raw.asset_id),
    utility_id: nullableString(raw.utility_id),
    title: raw.title?.trim() || 'Untitled repair',
    description: nullableString(raw.description),
    repair_type: enumValue(REPAIR_TYPES, raw.repair_type, 'general'),
    status: enumValue(REPAIR_STATUSES, raw.status, 'open'),
    priority: enumValue(REPAIR_PRIORITIES, raw.priority, 'normal'),
    reported_date: nullableString(raw.reported_date),
    completed_date: nullableString(raw.completed_date),
    contractor_name: nullableString(raw.contractor_name),
    contractor_phone: nullableString(raw.contractor_phone),
    contractor_email: nullableString(raw.contractor_email),
    estimated_cost: nullableNumber(raw.estimated_cost),
    actual_cost: nullableNumber(raw.actual_cost),
    notes: nullableString(raw.notes),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortRepairs(repairs: RepairRow[]) {
  return repairs.slice().sort((a, b) => {
    const aDate = a.reported_date || a.created_at;
    const bDate = b.reported_date || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

function writeDemoRepairs(repairs: RepairRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_REPAIRS_KEY, JSON.stringify(repairs));
}

function formatRepairError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  if (!needsMigration) {
    return detail;
  }

  return `Failed to ${action}. Apply ${PHASE_6F_MIGRATION} to your Supabase project, then try again. Original error: ${detail}`;
}

function buildRepairPayload(input: RepairInput, propertyId: string) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Repair title is required.');
  }

  return {
    property_id: propertyId,
    room_id: nullableString(input.room_id),
    asset_id: nullableString(input.asset_id),
    utility_id: nullableString(input.utility_id),
    title,
    description: nullableString(input.description),
    repair_type: input.repair_type || 'general',
    status: input.status || 'open',
    priority: input.priority || 'normal',
    reported_date: input.reported_date || null,
    completed_date: input.completed_date || null,
    contractor_name: nullableString(input.contractor_name),
    contractor_phone: nullableString(input.contractor_phone),
    contractor_email: nullableString(input.contractor_email),
    estimated_cost: input.estimated_cost ?? null,
    actual_cost: input.actual_cost ?? null,
    notes: nullableString(input.notes)
  };
}

export function getDemoRepairs() {
  return sortRepairs(
    getDemoCollection<Partial<RepairRow>>(DEMO_REPAIRS_KEY)
      .map(normalizeRepair)
      .filter((repair) => !repair.deleted_at)
  );
}

export async function getRepairDataContext(): Promise<RepairDataContext> {
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: null
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: null
    };
  }

  return {
    mode: 'supabase',
    supabaseConfigured,
    user,
    property: await getPrimaryPropertyForUser(user.id)
  };
}

export async function getRepairsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('repairs')
    .select(REPAIR_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatRepairError('load repairs', error.message));
  }

  return sortRepairs(((data ?? []) as Partial<RepairRow>[]).map(normalizeRepair));
}

export async function getRepairsForContext(context: RepairDataContext) {
  if (context.mode === 'demo') {
    return getDemoRepairs();
  }

  if (!context.property) {
    return [] as RepairRow[];
  }

  return getRepairsForProperty(context.property.id);
}

export async function getRepairsForRoom(context: RepairDataContext, roomId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoRepairs().filter((repair) => repair.room_id === roomId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('repairs')
    .select(REPAIR_SELECT)
    .eq('property_id', context.property.id)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatRepairError('load room repairs', error.message));
  }

  return sortRepairs(((data ?? []) as Partial<RepairRow>[]).map(normalizeRepair));
}

export async function getRepairsForAsset(context: RepairDataContext, assetId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoRepairs().filter((repair) => repair.asset_id === assetId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('repairs')
    .select(REPAIR_SELECT)
    .eq('property_id', context.property.id)
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatRepairError('load asset repairs', error.message));
  }

  return sortRepairs(((data ?? []) as Partial<RepairRow>[]).map(normalizeRepair));
}

export async function getRepairsForUtility(context: RepairDataContext, utilityId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoRepairs().filter((repair) => repair.utility_id === utilityId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('repairs')
    .select(REPAIR_SELECT)
    .eq('property_id', context.property.id)
    .eq('utility_id', utilityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatRepairError('load utility repairs', error.message));
  }

  return sortRepairs(((data ?? []) as Partial<RepairRow>[]).map(normalizeRepair));
}

export async function createRepairForContext(context: RepairDataContext, input: RepairInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const repair = normalizeRepair({
      ...buildRepairPayload(input, demoProperty?.id || ''),
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoRepairs([repair, ...getDemoRepairs()]);
    return repair;
  }

  if (!context.property) {
    throw new Error('Create a property before adding repairs.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('repairs')
    .insert(buildRepairPayload(input, context.property.id))
    .select(REPAIR_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatRepairError('create repair', error?.message));
  }

  return normalizeRepair(data as Partial<RepairRow>);
}

export async function updateRepairStatusForContext(
  context: RepairDataContext,
  repairId: string,
  status: RepairStatus
) {
  if (context.mode === 'demo') {
    const updated = getDemoRepairs().map((repair) =>
      repair.id === repairId
        ? {
            ...repair,
            status,
            completed_date: status === 'completed' ? repair.completed_date || new Date().toISOString().slice(0, 10) : repair.completed_date,
            updated_at: new Date().toISOString()
          }
        : repair
    );

    writeDemoRepairs(updated);
    return updated.find((repair) => repair.id === repairId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing repairs.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const payload =
    status === 'completed'
      ? { status, completed_date: new Date().toISOString().slice(0, 10) }
      : { status };

  const { data, error } = await supabase
    .from('repairs')
    .update(payload)
    .eq('id', repairId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(REPAIR_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatRepairError('update repair', error?.message));
  }

  return normalizeRepair(data as Partial<RepairRow>);
}

export async function deleteRepairForContext(context: RepairDataContext, repairId: string) {
  if (context.mode === 'demo') {
    writeDemoRepairs(getDemoRepairs().filter((repair) => repair.id !== repairId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting repairs.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('repairs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', repairId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatRepairError('delete repair', error.message));
  }
}
