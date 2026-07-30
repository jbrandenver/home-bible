import { formatDataError } from './errors';
import { PROPERTY_TYPES } from '@home-folder/shared';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase/client';
import { ensureProfileForUser, registerCacheInvalidator } from './auth';

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

  return formatDataError(
    step,
    message,
    looksLikeSchemaOrRls
      ? 'Apply supabase/migrations/003_phase6d_household_rls_repair.sql to your Supabase project, then try again.'
      : undefined
  );
}

export type PropertyAddressDetails = {
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  address_is_enabled: boolean;
};

// Pure single-line formatter so the sheet, settings preview, and tests all
// agree on what the shared address looks like.
export function formatAddressLine(details: Omit<PropertyAddressDetails, 'address_is_enabled'>): string | null {
  const cityState = [details.city, details.state]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join(', ');
  const parts = [details.address_line_1, details.address_line_2, cityState, details.postal_code].filter(
    (part) => typeof part === 'string' && part.trim().length > 0
  );

  return parts.length > 0 ? parts.join(', ') : null;
}

// Formatted single-line address for a property, respecting the owner's
// address_is_enabled flag. Returns null if disabled, unset, or unreadable.
export async function getPropertyAddressLine(propertyId: string): Promise<string | null> {
  const details = await getPropertyAddressDetails(propertyId);
  if (!details || !details.address_is_enabled) {
    return null;
  }

  return formatAddressLine(details);
}

export async function getPropertyAddressDetails(propertyId: string): Promise<PropertyAddressDetails | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('properties')
    .select('address_is_enabled, address_line_1, address_line_2, city, state, postal_code')
    .eq('id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    address_line_1: data.address_line_1 ?? null,
    address_line_2: data.address_line_2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postal_code: data.postal_code ?? null,
    address_is_enabled: Boolean(data.address_is_enabled)
  };
}

export async function updatePropertyAddress(propertyId: string, input: PropertyAddressDetails): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const clean = (value: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  };

  const { error } = await supabase
    .from('properties')
    .update({
      address_line_1: clean(input.address_line_1),
      address_line_2: clean(input.address_line_2),
      city: clean(input.city),
      state: clean(input.state),
      postal_code: clean(input.postal_code),
      address_is_enabled: input.address_is_enabled
    })
    .eq('id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatPropertySetupError('save property address', error.message));
  }
}

// Same problem as the auth user: every data context resolves the primary
// property independently, so one page load ran this 1-3 query lookup up to
// eight times. Concurrent callers share one in-flight lookup, and the result is
// reused briefly. Keyed by user id so switching accounts cannot read a stale
// property, and cleared outright whenever a property is created.
const PROPERTY_CACHE_MS = 5_000;

let cachedProperty: { userId: string; property: PropertySummary | null; at: number } | null = null;
let inFlightProperty: { userId: string; promise: Promise<PropertySummary | null> } | null = null;

export function clearCachedProperty() {
  cachedProperty = null;
  inFlightProperty = null;
}

// Drop the cached property whenever the signed-in user changes.
registerCacheInvalidator(clearCachedProperty);

export async function getPrimaryPropertyForUser(userId: string): Promise<PropertySummary | null> {
  if (cachedProperty && cachedProperty.userId === userId && Date.now() - cachedProperty.at < PROPERTY_CACHE_MS) {
    return cachedProperty.property;
  }

  if (inFlightProperty && inFlightProperty.userId === userId) {
    return inFlightProperty.promise;
  }

  const promise = loadPrimaryPropertyForUser(userId)
    .then((property) => {
      cachedProperty = { userId, property, at: Date.now() };
      return property;
    })
    .finally(() => {
      inFlightProperty = null;
    });

  inFlightProperty = { userId, promise };
  return promise;
}

async function loadPrimaryPropertyForUser(userId: string): Promise<PropertySummary | null> {
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

  // Errors must surface, not collapse to null. Callers read a null property as
  // "this user has no property yet" and fall back to demo/localStorage data —
  // so a momentary network failure used to replace a signed-in user's real
  // records with leftover browser data, silently and with no error shown.
  if (ownedError) {
    throw new Error(formatPropertySetupError('load your property', ownedError.message));
  }

  if (owned && owned.length > 0) {
    return owned[0] as PropertySummary;
  }

  const { data: memberRows, error: memberRowsError } = await supabase
    .from('property_members')
    .select('property_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (memberRowsError) {
    throw new Error(formatPropertySetupError('load your property', memberRowsError.message));
  }

  const propertyIds = (memberRows ?? []).map((row) => row.property_id).filter(Boolean);
  if (propertyIds.length === 0) {
    return null;
  }

  const { data: memberProperties, error: memberPropertiesError } = await supabase
    .from('properties')
    .select('id, household_id, owner_user_id, nickname, property_type, created_at')
    .in('id', propertyIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (memberPropertiesError) {
    throw new Error(formatPropertySetupError('load your property', memberPropertiesError.message));
  }

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
    if ('code' in error && error.code === '23505') {
      const { data: existingAfterConflict, error: conflictLoadError } = await supabase
        .from('households')
        .select('id, name')
        .eq('owner_user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (!conflictLoadError && existingAfterConflict && existingAfterConflict.length > 0) {
        return existingAfterConflict[0];
      }
    }

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

  const { data: userData } = await supabase.auth.getUser();
  const sessionUser = userData.user;

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

  // The caller navigates straight to a page that looks the property up again.
  clearCachedProperty();

  return {
    id: propertyId,
    household_id: household.id,
    owner_user_id: user.id,
    nickname: input.nickname,
    property_type: input.property_type,
    created_at: createdAt
  } as PropertySummary;
}
