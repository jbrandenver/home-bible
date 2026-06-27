import { PROPERTY_TYPES } from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase/client';
import { ensureProfileForUser } from './auth';

export type PropertyInput = {
  nickname: string;
  property_type: (typeof PROPERTY_TYPES)[number];
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type PropertySummary = {
  id: string;
  household_id: string;
  owner_user_id: string;
  nickname: string;
  property_type: string;
  created_at: string;
};

function formatPropertySetupError(step: string, message?: string) {
  const fallback = `Failed to ${step}.`;
  if (!message) {
    return fallback;
  }

  const lowerMessage = message.toLowerCase();
  const looksLikeSchemaOrRls =
    lowerMessage.includes('row-level security') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('on conflict') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('policy');

  if (!looksLikeSchemaOrRls) {
    return message;
  }

  return `${fallback} Apply supabase/migrations/003_phase6d_household_rls_repair.sql to your Supabase project, then try again. Original error: ${message}`;
}

export async function getPrimaryPropertyForUser(userId: string): Promise<PropertySummary | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data: owned, error: ownedError } = await supabase
    .from('properties')
    .select('id, household_id, owner_user_id, nickname, property_type, created_at')
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!ownedError && owned && owned.length > 0) {
    return owned[0] as PropertySummary;
  }

  const { data: memberRows } = await supabase
    .from('property_members')
    .select('property_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const propertyIds = (memberRows ?? []).map((row) => row.property_id).filter(Boolean);
  if (propertyIds.length === 0) {
    return null;
  }

  const { data: memberProperties } = await supabase
    .from('properties')
    .select('id, household_id, owner_user_id, nickname, property_type, created_at')
    .in('id', propertyIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!memberProperties || memberProperties.length === 0) {
    return null;
  }

  return memberProperties[0] as PropertySummary;
}

async function ensureHouseholdForUser(user: User, fallbackName: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: existing, error: existingError } = await supabase
    .from('households')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    throw new Error(formatPropertySetupError('load household', existingError.message));
  }

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const householdId = crypto.randomUUID();

  const { error } = await supabase
    .from('households')
    .insert({
      id: householdId,
      owner_user_id: user.id,
      name: `${fallbackName} Household`
    });

  if (error) {
    throw new Error(formatPropertySetupError('create household', error?.message));
  }

  const { error: memberError } = await supabase.from('household_members').upsert(
    {
      household_id: householdId,
      user_id: user.id,
      role: 'owner'
    },
    { onConflict: 'household_id,user_id' }
  );

  if (memberError) {
    throw new Error(formatPropertySetupError('create household membership', memberError.message));
  }

  return {
    id: householdId,
    name: `${fallbackName} Household`
  };
}

export async function createPropertyForUser(user: User, input: PropertyInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;

  if (!sessionUser || sessionUser.id !== user.id) {
    throw new Error('Your session expired. Please sign in again before creating a property.');
  }

  await ensureProfileForUser(user);

  const household = await ensureHouseholdForUser(user, input.nickname);

  const propertyId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const { error: propertyError } = await supabase
    .from('properties')
    .insert({
      id: propertyId,
      household_id: household.id,
      owner_user_id: user.id,
      nickname: input.nickname,
      property_type: input.property_type,
      address_line_1: input.address_line_1 ?? null,
      address_line_2: input.address_line_2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postal_code: input.postal_code ?? null,
      country: input.country ?? null,
      address_is_enabled: false,
      created_at: createdAt
    });

  if (propertyError) {
    throw new Error(formatPropertySetupError('create property', propertyError?.message));
  }

  const { error: propertyMemberError } = await supabase.from('property_members').upsert(
    {
      property_id: propertyId,
      user_id: user.id,
      role: 'owner'
    },
    { onConflict: 'property_id,user_id' }
  );

  if (propertyMemberError) {
    throw new Error(formatPropertySetupError('create property membership', propertyMemberError.message));
  }

  return {
    id: propertyId,
    household_id: household.id,
    owner_user_id: user.id,
    nickname: input.nickname,
    property_type: input.property_type,
    created_at: createdAt
  } as PropertySummary;
}
