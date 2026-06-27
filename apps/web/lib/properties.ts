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

  const { data: existing } = await supabase
    .from('households')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  const { data: created, error } = await supabase
    .from('households')
    .insert({
      owner_user_id: user.id,
      name: `${fallbackName} Household`
    })
    .select('id, name')
    .single();

  if (error || !created) {
    throw new Error(error?.message || 'Failed to create household');
  }

  await supabase.from('household_members').upsert(
    {
      household_id: created.id,
      user_id: user.id,
      role: 'owner'
    },
    { onConflict: 'household_id,user_id' }
  );

  return created;
}

export async function createPropertyForUser(user: User, input: PropertyInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  await ensureProfileForUser(user);

  const household = await ensureHouseholdForUser(user, input.nickname);

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .insert({
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
      address_is_enabled: false
    })
    .select('id, household_id, owner_user_id, nickname, property_type, created_at')
    .single();

  if (propertyError || !property) {
    throw new Error(propertyError?.message || 'Failed to create property');
  }

  await supabase.from('property_members').upsert(
    {
      property_id: property.id,
      user_id: user.id,
      role: 'owner'
    },
    { onConflict: 'property_id,user_id' }
  );

  return property as PropertySummary;
}
