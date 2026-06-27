import { SERVICE_TYPES } from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_SERVICE_RECORDS_KEY = 'homeBible.serviceRecords';
const PHASE_6F_MIGRATION = 'supabase/migrations/005_phase6f_repairs_service_records.sql';

export type ServiceRecordType = (typeof SERVICE_TYPES)[number];
export type ServiceRecordDataMode = 'demo' | 'supabase';

export type ServiceRecordRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  service_title: string;
  service_type: ServiceRecordType;
  service_date: string;
  provider_name: string | null;
  provider_phone: string | null;
  provider_email: string | null;
  cost: number | null;
  summary: string | null;
  notes: string | null;
  next_service_date: string | null;
  title: string;
  description: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  vendor_email: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  visibility: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ServiceRecordInput = {
  service_title: string;
  service_type?: ServiceRecordType;
  service_date?: string | null;
  provider_name?: string | null;
  provider_phone?: string | null;
  provider_email?: string | null;
  cost?: number | null;
  summary?: string | null;
  notes?: string | null;
  next_service_date?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
};

export type ServiceRecordDataContext = {
  mode: ServiceRecordDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

type RawServiceRecord = Omit<Partial<ServiceRecordRow>, 'service_title' | 'title' | 'service_date'> & {
  service_title?: string | null;
  title?: string | null;
  service_date?: string | null;
  description?: string | null;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  vendor_email?: string | null;
  follow_up_needed?: boolean | null;
  follow_up_date?: string | null;
  visibility?: string | null;
};

const SERVICE_RECORD_SELECT =
  'id, property_id, room_id, asset_id, utility_id, service_title, service_type, service_date, provider_name, provider_phone, provider_email, cost, summary, notes, next_service_date, title, description, vendor_name, vendor_phone, vendor_email, follow_up_needed, follow_up_date, visibility, created_at, updated_at, deleted_at';

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

function normalizeServiceType(value: unknown): ServiceRecordType {
  if (value === 'emergency_issue') return 'repair';
  if (value === 'remodel') return 'other';

  return typeof value === 'string' && (SERVICE_TYPES as readonly string[]).includes(value)
    ? (value as ServiceRecordType)
    : 'maintenance';
}

function normalizeServiceRecord(raw: RawServiceRecord): ServiceRecordRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const serviceTitle = nullableString(raw.service_title) || nullableString(raw.title) || 'Untitled service record';
  const providerName = nullableString(raw.provider_name) || nullableString(raw.vendor_name);
  const providerPhone = nullableString(raw.provider_phone) || nullableString(raw.vendor_phone);
  const providerEmail = nullableString(raw.provider_email) || nullableString(raw.vendor_email);
  const summary = nullableString(raw.summary) || nullableString(raw.description);
  const nextServiceDate = nullableString(raw.next_service_date) || nullableString(raw.follow_up_date);

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: nullableString(raw.room_id),
    asset_id: nullableString(raw.asset_id),
    utility_id: nullableString(raw.utility_id),
    service_title: serviceTitle,
    service_type: normalizeServiceType(raw.service_type),
    service_date: nullableString(raw.service_date) || createdAt.slice(0, 10),
    provider_name: providerName,
    provider_phone: providerPhone,
    provider_email: providerEmail,
    cost: nullableNumber(raw.cost),
    summary,
    notes: nullableString(raw.notes),
    next_service_date: nextServiceDate,
    title: serviceTitle,
    description: summary,
    vendor_name: providerName,
    vendor_phone: providerPhone,
    vendor_email: providerEmail,
    follow_up_needed: Boolean(raw.follow_up_needed || nextServiceDate),
    follow_up_date: nextServiceDate,
    visibility: nullableString(raw.visibility) || 'private',
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortServiceRecords(records: ServiceRecordRow[]) {
  return records.slice().sort((a, b) => {
    const dateDifference = new Date(b.service_date).getTime() - new Date(a.service_date).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function writeDemoServiceRecords(records: ServiceRecordRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_SERVICE_RECORDS_KEY, JSON.stringify(records));
}

function formatServiceRecordError(action: string, message?: string) {
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

function buildServiceRecordPayload(input: ServiceRecordInput, propertyId: string) {
  const serviceTitle = input.service_title.trim();
  if (!serviceTitle) {
    throw new Error('Service title is required.');
  }

  const providerName = nullableString(input.provider_name);
  const providerPhone = nullableString(input.provider_phone);
  const providerEmail = nullableString(input.provider_email);
  const summary = nullableString(input.summary);
  const nextServiceDate = input.next_service_date || null;

  return {
    property_id: propertyId,
    room_id: nullableString(input.room_id),
    asset_id: nullableString(input.asset_id),
    utility_id: nullableString(input.utility_id),
    service_title: serviceTitle,
    service_type: input.service_type || 'maintenance',
    service_date: input.service_date || null,
    provider_name: providerName,
    provider_phone: providerPhone,
    provider_email: providerEmail,
    cost: input.cost ?? null,
    summary,
    notes: nullableString(input.notes),
    next_service_date: nextServiceDate,
    title: serviceTitle,
    description: summary,
    vendor_name: providerName,
    vendor_phone: providerPhone,
    vendor_email: providerEmail,
    follow_up_needed: Boolean(nextServiceDate),
    follow_up_date: nextServiceDate,
    visibility: 'private'
  };
}

export function getDemoServiceRecords() {
  return sortServiceRecords(
    getDemoCollection<RawServiceRecord>(DEMO_SERVICE_RECORDS_KEY)
      .map(normalizeServiceRecord)
      .filter((record) => !record.deleted_at)
  );
}

export async function getServiceRecordDataContext(): Promise<ServiceRecordDataContext> {
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

export async function getServiceRecordsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('service_records')
    .select(SERVICE_RECORD_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatServiceRecordError('load service records', error.message));
  }

  return sortServiceRecords(((data ?? []) as RawServiceRecord[]).map(normalizeServiceRecord));
}

export async function getServiceRecordsForContext(context: ServiceRecordDataContext) {
  if (context.mode === 'demo') {
    return getDemoServiceRecords();
  }

  if (!context.property) {
    return [] as ServiceRecordRow[];
  }

  return getServiceRecordsForProperty(context.property.id);
}

export async function getServiceRecordsForRoom(context: ServiceRecordDataContext, roomId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoServiceRecords().filter((record) => record.room_id === roomId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('service_records')
    .select(SERVICE_RECORD_SELECT)
    .eq('property_id', context.property.id)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatServiceRecordError('load room service records', error.message));
  }

  return sortServiceRecords(((data ?? []) as RawServiceRecord[]).map(normalizeServiceRecord));
}

export async function getServiceRecordsForAsset(context: ServiceRecordDataContext, assetId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoServiceRecords().filter((record) => record.asset_id === assetId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('service_records')
    .select(SERVICE_RECORD_SELECT)
    .eq('property_id', context.property.id)
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatServiceRecordError('load asset service records', error.message));
  }

  return sortServiceRecords(((data ?? []) as RawServiceRecord[]).map(normalizeServiceRecord));
}

export async function getServiceRecordsForUtility(context: ServiceRecordDataContext, utilityId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoServiceRecords().filter((record) => record.utility_id === utilityId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('service_records')
    .select(SERVICE_RECORD_SELECT)
    .eq('property_id', context.property.id)
    .eq('utility_id', utilityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatServiceRecordError('load utility service records', error.message));
  }

  return sortServiceRecords(((data ?? []) as RawServiceRecord[]).map(normalizeServiceRecord));
}

export async function createServiceRecordForContext(
  context: ServiceRecordDataContext,
  input: ServiceRecordInput
) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const record = normalizeServiceRecord({
      ...buildServiceRecordPayload(input, demoProperty?.id || ''),
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoServiceRecords([record, ...getDemoServiceRecords()]);
    return record;
  }

  if (!context.property) {
    throw new Error('Create a property before adding service records.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('service_records')
    .insert(buildServiceRecordPayload(input, context.property.id))
    .select(SERVICE_RECORD_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatServiceRecordError('create service record', error?.message));
  }

  return normalizeServiceRecord(data as RawServiceRecord);
}

export async function deleteServiceRecordForContext(
  context: ServiceRecordDataContext,
  serviceRecordId: string
) {
  if (context.mode === 'demo') {
    writeDemoServiceRecords(getDemoServiceRecords().filter((record) => record.id !== serviceRecordId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting service records.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('service_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', serviceRecordId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatServiceRecordError('delete service record', error.message));
  }
}
