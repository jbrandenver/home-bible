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
  parent_property_id?: string | null;
  unit_label?: string | null;
};

export type PropertySummary = {
  id: string;
  household_id: string;
  owner_user_id: string;
  nickname: string;
  property_type: string;
  created_at: string;
  parent_property_id: string | null;
  unit_label: string | null;
  /** Set when the home is archived (migration 029) — hidden from active use, restorable for a window. */
  archived_at?: string | null;
};

const PROPERTY_SUMMARY_COLUMNS =
  'id, household_id, owner_user_id, nickname, property_type, created_at, parent_property_id, unit_label, archived_at';

function formatPropertySetupError(step: string, message?: string) {
  const fallback = `Failed to ${step}.`;
  if (!message) {
    return fallback;
  }

  const lowerMessage = message.toLowerCase();

  // The home allowance is enforced by a trigger (migration 035), so hitting it
  // arrives here as a database error. It is a billing outcome, not a fault:
  // surface the server's own sentence rather than wrapping it in "failed to
  // create property" and a migration hint meant for schema problems.
  if (lowerMessage.includes('homes. add another home on the portfolio plan')) {
    return message;
  }
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

export type PropertyType = (typeof PROPERTY_TYPES)[number];

// What the property is, beyond its address. The nickname and type were set once
// at creation and could never be corrected; the profile flags below have always
// existed in the schema but no form ever wrote them, even though the seasonal
// plan reads has_yard and has_basement.
export type PropertyDetails = {
  nickname: string;
  property_type: PropertyType;
  unit_label: string | null;
  square_feet: number | null;
  year_built: number | null;
  floor_count: number | null;
  has_garage: boolean;
  has_basement: boolean;
  has_attic: boolean;
  has_crawl_space: boolean;
  has_yard: boolean;
  has_shed: boolean;
};

const PROPERTY_DETAIL_COLUMNS =
  'nickname, property_type, unit_label, square_feet, year_built, floor_count, has_garage, has_basement, has_attic, has_crawl_space, has_yard, has_shed';

function toPropertyType(value: unknown): PropertyType {
  return typeof value === 'string' && (PROPERTY_TYPES as readonly string[]).includes(value)
    ? (value as PropertyType)
    : 'single_family_home';
}

function toWholeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function getPropertyDetails(propertyId: string): Promise<PropertyDetails | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('properties')
    .select(PROPERTY_DETAIL_COLUMNS)
    .eq('id', propertyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    nickname: data.nickname || '',
    property_type: toPropertyType(data.property_type),
    unit_label: data.unit_label ?? null,
    square_feet: toWholeNumber(data.square_feet),
    year_built: toWholeNumber(data.year_built),
    floor_count: toWholeNumber(data.floor_count),
    has_garage: Boolean(data.has_garage),
    has_basement: Boolean(data.has_basement),
    has_attic: Boolean(data.has_attic),
    has_crawl_space: Boolean(data.has_crawl_space),
    has_yard: Boolean(data.has_yard),
    has_shed: Boolean(data.has_shed)
  };
}

/**
 * Correct what a property is. Deliberately excludes parent_property_id — a
 * property cannot be re-parented (migration 025 guards it) — and owner_user_id,
 * which has a guard trigger of its own. Address fields keep their own writer.
 */
export async function updatePropertyDetails(propertyId: string, input: PropertyDetails): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const nickname = input.nickname.trim();
  if (!nickname) {
    throw new Error('A property needs a name — it is how you tell your homes apart.');
  }

  const unitLabel = typeof input.unit_label === 'string' ? input.unit_label.trim() : '';

  const { error } = await supabase
    .from('properties')
    .update({
      nickname,
      property_type: input.property_type,
      unit_label: unitLabel.length > 0 ? unitLabel : null,
      square_feet: toWholeNumber(input.square_feet),
      year_built: toWholeNumber(input.year_built),
      floor_count: toWholeNumber(input.floor_count),
      has_garage: input.has_garage,
      has_basement: input.has_basement,
      has_attic: input.has_attic,
      has_crawl_space: input.has_crawl_space,
      has_yard: input.has_yard,
      has_shed: input.has_shed
    })
    .eq('id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatPropertySetupError('save property details', error.message));
  }

  // The nickname is shown by the switcher and page headers, which read the
  // cached summary.
  clearCachedProperty();
}

/**
 * Write only what the room list implies: the floor count, and the six feature
 * flags derived from the rooms themselves.
 *
 * Narrow on purpose. updatePropertyDetails above writes the whole record, so
 * calling it from onboarding would blank a returning person's square footage
 * and year built — the same trap updatePropertyAddress sets for anyone who
 * only wants to change one field.
 *
 * The flags are a derivation, never a second source of truth: rooms are what
 * a person actually stated, and these follow from them.
 */
export async function updatePropertyStructure(
  propertyId: string,
  input: {
    floor_count: number | null;
    has_garage: boolean;
    has_basement: boolean;
    has_attic: boolean;
    has_crawl_space: boolean;
    has_yard: boolean;
    has_shed: boolean;
  }
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const { error } = await supabase
    .from('properties')
    .update({
      floor_count: toWholeNumber(input.floor_count),
      has_garage: input.has_garage,
      has_basement: input.has_basement,
      has_attic: input.has_attic,
      has_crawl_space: input.has_crawl_space,
      has_yard: input.has_yard,
      has_shed: input.has_shed
    })
    .eq('id', propertyId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatPropertySetupError('save property details', error.message));
  }
}

// Soft delete, matching rooms and the delete-account flow: the row keeps its
// history but disappears from every deleted_at-filtered read. A building takes
// its units with it — a unit whose parent is gone would be unreachable in the
// switcher. RLS allows any editor to update, so the owner filter here keeps
// this rare, destructive action to the person who created the home.
export async function deletePropertyForOwner(propertyId: string, ownerUserId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // A direct UPDATE cannot soft-delete: the RLS policy's WITH CHECK
  // re-evaluates ownership against the new row, and a deleted row has no
  // owner. The SECURITY DEFINER RPC (migration 030) verifies auth.uid() is
  // the live owner itself, and takes a building's units along.
  void ownerUserId; // ownership is proven server-side from auth.uid()
  const { error } = await supabase.rpc('delete_property_as_owner', {
    p_property_id: propertyId
  });

  if (error) {
    throw new Error(formatPropertySetupError('delete this home', error.message));
  }

  if (getActivePropertyId() === propertyId) {
    setActivePropertyId(null);
  }
  clearCachedProperty();
}

// How long an archived home is restorable before it is treated like any other
// deletion. Archiving never changes billing; only deletion does.
export const ARCHIVE_RETENTION_DAYS = 90;

export function archiveDeleteDate(archivedAt: string): Date {
  const date = new Date(archivedAt);
  date.setDate(date.getDate() + ARCHIVE_RETENTION_DAYS);
  return date;
}

// Archive: the home leaves the switcher and every active list but keeps all
// of its rows, restorable for ARCHIVE_RETENTION_DAYS. A building archives
// its units with it, same as delete.
export async function archivePropertyForOwner(propertyId: string, ownerUserId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Ownership is proved inside the RPC from auth.uid(). It used to be an
  // owner_user_id filter on the update, but RLS admits any editor, so an
  // editor could archive the owner's home by dropping that filter — and the
  // owner's own session would later purge it. The RPC archives the building's
  // units with it.
  const { error } = await supabase.rpc('archive_property_as_owner', {
    p_property_id: propertyId
  });

  if (error) {
    throw new Error(formatPropertySetupError('archive this home', error.message));
  }

  if (getActivePropertyId() === propertyId) {
    setActivePropertyId(null);
  }
  clearCachedProperty();
}

export async function restorePropertyForOwner(propertyId: string, ownerUserId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Ownership is proved inside the RPC from auth.uid(); see archive above.
  const { error } = await supabase.rpc('restore_property_as_owner', {
    p_property_id: propertyId
  });

  if (error) {
    throw new Error(formatPropertySetupError('restore this home', error.message));
  }

  clearCachedProperty();
}

// Archives past their retention window become deletions. Run opportunistically
// when the portfolio loads — no cron required at this scale, and a stale
// archive lingering a few extra days until the next visit only errs gently.
export async function purgeExpiredArchivedProperties(ownerUserId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  // Same WITH CHECK trap as deletion — the purge runs through the
  // SECURITY DEFINER RPC (migration 030), scoped server-side to auth.uid().
  void ownerUserId;
  await supabase.rpc('purge_expired_archived_properties', {
    p_retention_days: ARCHIVE_RETENTION_DAYS
  });
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

// The property the user is currently working in, persisted across page loads
// so the portfolio switcher survives navigation. localStorage rather than a
// cookie: this is a UI preference, not an authorization input — RLS decides
// what any property id actually yields.
const ACTIVE_PROPERTY_STORAGE_KEY = 'home-folder.active-property-id';

export function getActivePropertyId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(ACTIVE_PROPERTY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActivePropertyId(propertyId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (propertyId) {
      window.localStorage.setItem(ACTIVE_PROPERTY_STORAGE_KEY, propertyId);
    } else {
      window.localStorage.removeItem(ACTIVE_PROPERTY_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the switcher just won't stick.
  }
  clearCachedProperty();
}

// Every property the user can see: owned first, then memberships, deduped.
// Buildings sort before their units so pickers read naturally.
export async function listPropertiesForUser(userId: string): Promise<PropertySummary[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const { data: owned, error: ownedError } = await supabase
    .from('properties')
    .select(PROPERTY_SUMMARY_COLUMNS)
    .eq('owner_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);

  if (ownedError) {
    throw new Error(formatPropertySetupError('load your properties', ownedError.message));
  }

  const { data: memberRows, error: memberRowsError } = await supabase
    .from('property_members')
    .select('property_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(500);

  if (memberRowsError) {
    throw new Error(formatPropertySetupError('load your properties', memberRowsError.message));
  }

  const ownedList = (owned ?? []) as PropertySummary[];
  const ownedIds = new Set(ownedList.map((property) => property.id));
  const memberIds = (memberRows ?? [])
    .map((row) => row.property_id)
    .filter((id): id is string => Boolean(id) && !ownedIds.has(id));

  let memberList: PropertySummary[] = [];
  if (memberIds.length > 0) {
    const { data: memberProperties, error: memberPropertiesError } = await supabase
      .from('properties')
      .select(PROPERTY_SUMMARY_COLUMNS)
      .in('id', memberIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (memberPropertiesError) {
      throw new Error(formatPropertySetupError('load your properties', memberPropertiesError.message));
    }

    memberList = (memberProperties ?? []) as PropertySummary[];
  }

  return sortPortfolio([...ownedList, ...memberList]);
}

// Buildings (and standalone homes) in creation order, each followed by its
// units. Pure and exported so the switcher, the portfolio page and tests agree.
export function sortPortfolio(properties: PropertySummary[]): PropertySummary[] {
  const topLevel = properties
    .filter((property) => !property.parent_property_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const unitsByParent = new Map<string, PropertySummary[]>();
  const orphans: PropertySummary[] = [];

  for (const property of properties) {
    if (!property.parent_property_id) {
      continue;
    }
    const bucket = unitsByParent.get(property.parent_property_id);
    if (bucket) {
      bucket.push(property);
    } else {
      unitsByParent.set(property.parent_property_id, [property]);
    }
  }

  const ordered: PropertySummary[] = [];
  for (const parent of topLevel) {
    ordered.push(parent);
    const units = (unitsByParent.get(parent.id) ?? []).sort(
      (a, b) =>
        (a.unit_label ?? '').localeCompare(b.unit_label ?? '', undefined, { numeric: true }) ||
        a.created_at.localeCompare(b.created_at)
    );
    ordered.push(...units);
    unitsByParent.delete(parent.id);
  }

  // Units whose building the user cannot see (e.g. invited to one unit only).
  for (const units of unitsByParent.values()) {
    orphans.push(...units);
  }
  orphans.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return [...ordered, ...orphans];
}

async function loadPrimaryPropertyForUser(userId: string): Promise<PropertySummary | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  // Errors must surface, not collapse to null. Callers read a null property as
  // "this user has no property yet" and fall back to demo/localStorage data —
  // so a momentary network failure used to replace a signed-in user's real
  // records with leftover browser data, silently and with no error shown.
  // Archived homes are set aside — they must never become the active
  // property the whole app works inside.
  const properties = (await listPropertiesForUser(userId)).filter(
    (property) => !property.archived_at
  );
  if (properties.length === 0) {
    return null;
  }

  // An explicit switcher choice wins; otherwise prefer a building or home over
  // a unit, newest first — matching the old "newest owned" behaviour while
  // keeping "Unit 12" from becoming someone's whole app after a bulk import.
  const activeId = getActivePropertyId();
  if (activeId) {
    const active = properties.find((property) => property.id === activeId);
    if (active) {
      return active;
    }
    // The pin points at a home this account cannot see — a leftover from a
    // previous account in this browser. Clear it so every later reader gets
    // the fallback too, instead of re-tripping on the stale id.
    setActivePropertyId(null);
  }

  const newestFirst = [...properties].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const owned = newestFirst.filter((property) => property.owner_user_id === userId);
  const pool = owned.length > 0 ? owned : newestFirst;
  return pool.find((property) => !property.parent_property_id) ?? pool[0];
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
      parent_property_id: input.parent_property_id ?? null,
      unit_label: input.unit_label ?? null,
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
    created_at: createdAt,
    parent_property_id: input.parent_property_id ?? null,
    unit_label: input.unit_label ?? null
  } as PropertySummary;
}

// Bulk unit creation for a building. Sequential on purpose: each insert runs
// the nesting guard trigger, and a landlord adding 30 units should get a
// precise "unit 17 failed" rather than an all-or-nothing mystery.
export async function createUnitsForBuilding(
  user: User,
  building: PropertySummary,
  unitLabels: string[]
): Promise<{ created: PropertySummary[]; failed: { label: string; message: string }[] }> {
  const created: PropertySummary[] = [];
  const failed: { label: string; message: string }[] = [];

  for (const rawLabel of unitLabels) {
    const label = rawLabel.trim();
    if (!label) {
      continue;
    }

    try {
      const unit = await createPropertyForUser(user, {
        nickname: `${building.nickname} — ${label}`,
        property_type: 'apartment',
        parent_property_id: building.id,
        unit_label: label
      });
      created.push(unit);
    } catch (unitError) {
      failed.push({
        label,
        message: unitError instanceof Error ? unitError.message : 'Failed to create unit.'
      });
    }
  }

  clearCachedProperty();
  return { created, failed };
}
