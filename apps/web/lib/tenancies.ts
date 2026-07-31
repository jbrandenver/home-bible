import { formatDataError } from './errors';
import {
  TENANCY_STATUSES,
  createTenancySchema,
  type TenancyStatus
} from '@home-folder/shared';
import { getSupabaseSetupMessage } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

// Tenancies are landlord records: Supabase-only (no demo mode), scoped to the
// active property, soft-deleted like every other table. See migration 023.
const PORTFOLIO_MIGRATION = 'supabase/migrations/023_portfolio_foundation.sql';

export type TenancyRow = {
  id: string;
  property_id: string;
  label: string;
  tenant_names: string | null;
  start_date: string | null;
  end_date: string | null;
  deposit_amount_cents: number | null;
  deposit_currency: string;
  deposit_returned_on: string | null;
  status: TenancyStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** What the pages pass in; validated against createTenancySchema before insert. */
export type TenancyFormInput = {
  property_id: string;
  label: string;
  tenant_names?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  deposit_amount_cents?: number | null;
  deposit_currency?: string;
  deposit_returned_on?: string | null;
  status?: TenancyStatus;
  notes?: string | null;
};

export type TenancyPatch = Partial<Omit<TenancyFormInput, 'property_id'>>;

const TENANCY_SELECT =
  'id, property_id, label, tenant_names, start_date, end_date, deposit_amount_cents, deposit_currency, deposit_returned_on, status, notes, created_by, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableCents(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeTenancy(raw: Partial<TenancyRow>): TenancyRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || '',
    label: raw.label?.trim() || 'Untitled tenancy',
    tenant_names: nullableString(raw.tenant_names),
    start_date: nullableString(raw.start_date),
    end_date: nullableString(raw.end_date),
    deposit_amount_cents: nullableCents(raw.deposit_amount_cents),
    deposit_currency: nullableString(raw.deposit_currency) || 'usd',
    deposit_returned_on: nullableString(raw.deposit_returned_on),
    status: enumValue(TENANCY_STATUSES, raw.status, 'active'),
    notes: nullableString(raw.notes),
    created_by: nullableString(raw.created_by),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function formatTenancyError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${PORTFOLIO_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  return supabase;
}

function sortTenancies(tenancies: TenancyRow[]) {
  return tenancies.slice().sort((a, b) => {
    const aDate = a.start_date || a.created_at;
    const bDate = b.start_date || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

export async function listTenancies(propertyId: string) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('tenancies')
    .select(TENANCY_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatTenancyError('load tenancies', error.message));
  }

  return sortTenancies(((data ?? []) as Partial<TenancyRow>[]).map(normalizeTenancy));
}

function buildTenancyPatchPayload(patch: TenancyPatch) {
  const payload: Record<string, unknown> = {};

  if (patch.label !== undefined) {
    const label = patch.label?.trim();
    if (!label) {
      throw new Error('A tenancy label is required.');
    }
    payload.label = label;
  }
  if (patch.tenant_names !== undefined) payload.tenant_names = nullableString(patch.tenant_names);
  if (patch.start_date !== undefined) payload.start_date = nullableString(patch.start_date);
  if (patch.end_date !== undefined) payload.end_date = nullableString(patch.end_date);
  if (patch.deposit_amount_cents !== undefined) {
    payload.deposit_amount_cents = nullableCents(patch.deposit_amount_cents);
  }
  if (patch.deposit_currency !== undefined) {
    payload.deposit_currency = nullableString(patch.deposit_currency) || 'usd';
  }
  if (patch.deposit_returned_on !== undefined) {
    payload.deposit_returned_on = nullableString(patch.deposit_returned_on);
  }
  if (patch.status !== undefined) {
    payload.status = enumValue(TENANCY_STATUSES, patch.status, 'active');
  }
  if (patch.notes !== undefined) payload.notes = nullableString(patch.notes);

  return payload;
}

export async function createTenancy(input: TenancyFormInput) {
  const parsed = createTenancySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Check the tenancy details and try again.');
  }

  const supabase = requireSupabase();
  const values = parsed.data;

  const { data, error } = await supabase
    .from('tenancies')
    .insert({
      property_id: values.property_id,
      label: values.label.trim(),
      tenant_names: nullableString(values.tenant_names),
      start_date: nullableString(values.start_date),
      end_date: nullableString(values.end_date),
      deposit_amount_cents: nullableCents(values.deposit_amount_cents),
      deposit_currency: nullableString(values.deposit_currency) || 'usd',
      deposit_returned_on: nullableString(values.deposit_returned_on),
      status: values.status,
      notes: nullableString(values.notes)
    })
    .select(TENANCY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatTenancyError('create tenancy', error?.message));
  }

  return normalizeTenancy(data as Partial<TenancyRow>);
}

export async function updateTenancy(id: string, patch: TenancyPatch) {
  const payload = buildTenancyPatchPayload(patch);
  if (Object.keys(payload).length === 0) {
    throw new Error('Nothing to update on this tenancy.');
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('tenancies')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select(TENANCY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatTenancyError('update tenancy', error?.message));
  }

  return normalizeTenancy(data as Partial<TenancyRow>);
}

export async function softDeleteTenancy(id: string) {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('tenancies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatTenancyError('delete tenancy', error.message));
  }
}
