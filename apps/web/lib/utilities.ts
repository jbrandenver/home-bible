import { UTILITY_TYPES } from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_UTILITIES_KEY = 'homeBible.utilities';

export type UtilityType = (typeof UTILITY_TYPES)[number];
export type UtilityDataMode = 'demo' | 'supabase';

export type UtilityRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  utility_type: UtilityType;
  name: string;
  location_notes: string | null;
  emergency_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UtilityInput = {
  utility_type: UtilityType;
  name: string;
  room_id?: string | null;
  location_notes?: string | null;
  emergency_notes?: string | null;
};

export type UtilityDataContext = {
  mode: UtilityDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

const UTILITY_SELECT =
  'id, property_id, room_id, utility_type, name, location_notes, emergency_notes, created_at, updated_at, deleted_at';

function normalizeUtility(raw: Partial<UtilityRow>): UtilityRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const utilityType = UTILITY_TYPES.includes(raw.utility_type as UtilityType)
    ? (raw.utility_type as UtilityType)
    : 'other';

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: raw.room_id || null,
    utility_type: utilityType,
    name: raw.name || 'Untitled utility',
    location_notes: raw.location_notes || null,
    emergency_notes: raw.emergency_notes || null,
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function writeDemoUtilities(utilities: UtilityRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_UTILITIES_KEY, JSON.stringify(utilities));
}

export function getDemoUtilities() {
  return getDemoCollection<Partial<UtilityRow>>(DEMO_UTILITIES_KEY)
    .map(normalizeUtility)
    .filter((utility) => !utility.deleted_at);
}

export async function getUtilityDataContext(): Promise<UtilityDataContext> {
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

export async function getUtilitiesForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('utilities')
    .select(UTILITY_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load utilities.');
  }

  return ((data ?? []) as Partial<UtilityRow>[]).map(normalizeUtility);
}

export async function getUtilitiesForContext(context: UtilityDataContext) {
  if (context.mode === 'demo') {
    return getDemoUtilities();
  }

  if (!context.property) {
    return [] as UtilityRow[];
  }

  return getUtilitiesForProperty(context.property.id);
}

export async function getUtilitiesForRoom(context: UtilityDataContext, roomId: string) {
  if (context.mode === 'demo') {
    return getDemoUtilities().filter((utility) => utility.room_id === roomId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('utilities')
    .select(UTILITY_SELECT)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load room utilities.');
  }

  return ((data ?? []) as Partial<UtilityRow>[]).map(normalizeUtility);
}

export async function getUtilityByIdForContext(context: UtilityDataContext, utilityId: string) {
  if (context.mode === 'demo') {
    return getDemoUtilities().find((utility) => utility.id === utilityId) || null;
  }

  if (!context.property) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('utilities')
    .select(UTILITY_SELECT)
    .eq('id', utilityId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load utility.');
  }

  return data ? normalizeUtility(data as Partial<UtilityRow>) : null;
}

export async function createUtilityForContext(context: UtilityDataContext, input: UtilityInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const utility: UtilityRow = {
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      room_id: input.room_id || null,
      utility_type: input.utility_type,
      name: input.name.trim(),
      location_notes: input.location_notes?.trim() || null,
      emergency_notes: input.emergency_notes?.trim() || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    };

    writeDemoUtilities([...getDemoUtilities(), utility]);
    return utility;
  }

  if (!context.property) {
    throw new Error('Create a property before adding utilities.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('utilities')
    .insert({
      property_id: context.property.id,
      room_id: input.room_id || null,
      utility_type: input.utility_type,
      name: input.name.trim(),
      location_notes: input.location_notes?.trim() || null,
      emergency_notes: input.emergency_notes?.trim() || null
    })
    .select(UTILITY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create utility.');
  }

  return normalizeUtility(data as Partial<UtilityRow>);
}

export async function updateUtilityForContext(
  context: UtilityDataContext,
  utilityId: string,
  input: UtilityInput
) {
  if (context.mode === 'demo') {
    const updated = getDemoUtilities().map((utility) =>
      utility.id === utilityId
        ? {
            ...utility,
            room_id: input.room_id || null,
            utility_type: input.utility_type,
            name: input.name.trim(),
            location_notes: input.location_notes?.trim() || null,
            emergency_notes: input.emergency_notes?.trim() || null,
            updated_at: new Date().toISOString()
          }
        : utility
    );

    writeDemoUtilities(updated);
    return updated.find((utility) => utility.id === utilityId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing utilities.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('utilities')
    .update({
      room_id: input.room_id || null,
      utility_type: input.utility_type,
      name: input.name.trim(),
      location_notes: input.location_notes?.trim() || null,
      emergency_notes: input.emergency_notes?.trim() || null
    })
    .eq('id', utilityId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(UTILITY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update utility.');
  }

  return normalizeUtility(data as Partial<UtilityRow>);
}

export async function deleteUtilityForContext(context: UtilityDataContext, utilityId: string) {
  if (context.mode === 'demo') {
    writeDemoUtilities(getDemoUtilities().filter((utility) => utility.id !== utilityId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting utilities.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('utilities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', utilityId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message || 'Failed to delete utility.');
  }
}
