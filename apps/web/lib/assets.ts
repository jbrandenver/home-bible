import { ASSET_TYPES, VISIBILITY_OPTIONS } from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_ASSETS_KEY = 'homeBible.assets';

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetVisibility = (typeof VISIBILITY_OPTIONS)[number];
export type AssetDataMode = 'demo' | 'supabase';

export type AssetRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_type: AssetType;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  retailer: string | null;
  warranty_length_months: number | null;
  warranty_expires_at: string | null;
  manual_url: string | null;
  support_url: string | null;
  notes: string | null;
  visibility: AssetVisibility;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AssetInput = {
  asset_type: AssetType;
  name: string;
  room_id?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  retailer?: string | null;
  warranty_length_months?: number | null;
  warranty_expires_at?: string | null;
  manual_url?: string | null;
  support_url?: string | null;
  notes?: string | null;
  visibility?: AssetVisibility;
};

export type AssetUpdateInput = Partial<AssetInput>;

export type AssetDataContext = {
  mode: AssetDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

const ASSET_SELECT =
  'id, property_id, room_id, asset_type, name, brand, model, serial_number, purchase_date, purchase_price, retailer, warranty_length_months, warranty_expires_at, manual_url, support_url, notes, visibility, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeAsset(raw: Partial<AssetRow>): AssetRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const assetType = ASSET_TYPES.includes(raw.asset_type as AssetType)
    ? (raw.asset_type as AssetType)
    : 'other';
  const visibility = VISIBILITY_OPTIONS.includes(raw.visibility as AssetVisibility)
    ? (raw.visibility as AssetVisibility)
    : 'private';

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: raw.room_id || null,
    asset_type: assetType,
    name: raw.name || 'Untitled asset',
    brand: nullableString(raw.brand),
    model: nullableString(raw.model),
    serial_number: nullableString(raw.serial_number),
    purchase_date: nullableString(raw.purchase_date),
    purchase_price: nullableNumber(raw.purchase_price),
    retailer: nullableString(raw.retailer),
    warranty_length_months: nullableNumber(raw.warranty_length_months),
    warranty_expires_at: nullableString(raw.warranty_expires_at),
    manual_url: nullableString(raw.manual_url),
    support_url: nullableString(raw.support_url),
    notes: nullableString(raw.notes),
    visibility,
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function writeDemoAssets(assets: AssetRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_ASSETS_KEY, JSON.stringify(assets));
}

function cleanInput(input: AssetUpdateInput) {
  const cleaned: Record<string, unknown> = {};

  if (input.asset_type !== undefined) cleaned.asset_type = input.asset_type;
  if (input.name !== undefined) cleaned.name = input.name.trim();
  if (input.room_id !== undefined) cleaned.room_id = input.room_id || null;
  if (input.brand !== undefined) cleaned.brand = input.brand?.trim() || null;
  if (input.model !== undefined) cleaned.model = input.model?.trim() || null;
  if (input.serial_number !== undefined) cleaned.serial_number = input.serial_number?.trim() || null;
  if (input.purchase_date !== undefined) cleaned.purchase_date = input.purchase_date || null;
  if (input.purchase_price !== undefined) cleaned.purchase_price = input.purchase_price ?? null;
  if (input.retailer !== undefined) cleaned.retailer = input.retailer?.trim() || null;
  if (input.warranty_length_months !== undefined) cleaned.warranty_length_months = input.warranty_length_months ?? null;
  if (input.warranty_expires_at !== undefined) cleaned.warranty_expires_at = input.warranty_expires_at || null;
  if (input.manual_url !== undefined) cleaned.manual_url = input.manual_url?.trim() || null;
  if (input.support_url !== undefined) cleaned.support_url = input.support_url?.trim() || null;
  if (input.notes !== undefined) cleaned.notes = input.notes?.trim() || null;
  if (input.visibility !== undefined) cleaned.visibility = input.visibility;

  return cleaned;
}

export function getDemoAssets() {
  return getDemoCollection<Partial<AssetRow>>(DEMO_ASSETS_KEY)
    .map(normalizeAsset)
    .filter((asset) => !asset.deleted_at);
}

export async function getAssetDataContext(): Promise<AssetDataContext> {
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

export async function getAssetsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load assets.');
  }

  return ((data ?? []) as Partial<AssetRow>[]).map(normalizeAsset);
}

export async function getAssetsForContext(context: AssetDataContext) {
  if (context.mode === 'demo') {
    return getDemoAssets();
  }

  if (!context.property) {
    return [] as AssetRow[];
  }

  return getAssetsForProperty(context.property.id);
}

export async function getAssetsForRoom(context: AssetDataContext, roomId: string) {
  if (context.mode === 'demo') {
    return getDemoAssets().filter((asset) => asset.room_id === roomId);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load room assets.');
  }

  return ((data ?? []) as Partial<AssetRow>[]).map(normalizeAsset);
}

export async function getAssetByIdForContext(context: AssetDataContext, assetId: string) {
  if (context.mode === 'demo') {
    return getDemoAssets().find((asset) => asset.id === assetId) || null;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('assets')
    .select(ASSET_SELECT)
    .eq('id', assetId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load asset.');
  }

  return data ? normalizeAsset(data as Partial<AssetRow>) : null;
}

export async function createAssetForContext(context: AssetDataContext, input: AssetInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const asset: AssetRow = normalizeAsset({
      ...input,
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoAssets([...getDemoAssets(), asset]);
    return asset;
  }

  if (!context.property) {
    throw new Error('Create a property before adding assets.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('assets')
    .insert({
      property_id: context.property.id,
      ...cleanInput(input)
    })
    .select(ASSET_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create asset.');
  }

  return normalizeAsset(data as Partial<AssetRow>);
}

export async function updateAssetForContext(
  context: AssetDataContext,
  assetId: string,
  input: AssetUpdateInput
) {
  if (context.mode === 'demo') {
    const updatedAssets = getDemoAssets().map((asset) =>
      asset.id === assetId
        ? normalizeAsset({
            ...asset,
            ...cleanInput(input),
            updated_at: new Date().toISOString()
          })
        : asset
    );

    writeDemoAssets(updatedAssets);
    return updatedAssets.find((asset) => asset.id === assetId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing assets.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('assets')
    .update(cleanInput(input))
    .eq('id', assetId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(ASSET_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update asset.');
  }

  return normalizeAsset(data as Partial<AssetRow>);
}

export async function deleteAssetForContext(context: AssetDataContext, assetId: string) {
  if (context.mode === 'demo') {
    writeDemoAssets(getDemoAssets().filter((asset) => asset.id !== assetId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting assets.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message || 'Failed to delete asset.');
  }
}
