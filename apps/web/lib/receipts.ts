import {
  RECEIPT_APPROVAL_STATUSES,
  RECEIPT_CATEGORIES,
  RECEIPT_SOURCES,
  type ReceiptApprovalStatus,
  type ReceiptCategory,
  type ReceiptRow as SharedReceiptRow,
  type ReceiptSource
} from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { ensureProfileForUser, getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import {
  uploadDocumentForContext,
  type DocumentDataContext,
  type DocumentLinkInput,
  type DocumentRow
} from './documents';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const PHASE_6J_MIGRATION = 'supabase/migrations/008_phase6j_receipts.sql';

export const RECEIPT_FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

const RECEIPT_MIME_BY_EXTENSION: Record<string, (typeof RECEIPT_FILE_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

export type ReceiptDataMode = 'demo' | 'supabase';
export type ReceiptRow = SharedReceiptRow;

export type ReceiptDataContext = {
  mode: ReceiptDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

export type ReceiptLinkInput = {
  room_id?: string | null;
  utility_id?: string | null;
  asset_id?: string | null;
  repair_id?: string | null;
  service_record_id?: string | null;
};

export type ReceiptUploadInput = ReceiptLinkInput & {
  file: File;
  title: string;
  description?: string | null;
};

export type ReceiptInput = ReceiptLinkInput & {
  document_id?: string | null;
  vendor_name?: string | null;
  purchase_date?: string | null;
  total_amount?: number | null;
  tax_amount?: number | null;
  currency?: string | null;
  payment_method?: string | null;
  category?: ReceiptCategory;
  description?: string | null;
  notes?: string | null;
  source?: Extract<ReceiptSource, 'manual_entry' | 'manual_review'>;
};

export type ReceiptUpdateInput = Partial<ReceiptInput>;

export type ReceiptLinkField =
  | 'room_id'
  | 'utility_id'
  | 'asset_id'
  | 'repair_id'
  | 'service_record_id';

export type ReceiptLinkTarget = {
  field: ReceiptLinkField;
  id: string;
};

const RECEIPT_SELECT =
  'id, property_id, document_id, room_id, utility_id, asset_id, repair_id, service_record_id, vendor_name, purchase_date, total_amount, tax_amount, currency, payment_method, category, description, notes, approval_status, source, created_by, approved_by, approved_at, created_at, updated_at, deleted_at';

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

function normalizeCurrency(value: unknown) {
  const currency = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : 'USD';
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
}

function normalizeReceipt(raw: Partial<ReceiptRow>): ReceiptRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || '',
    document_id: nullableString(raw.document_id),
    room_id: nullableString(raw.room_id),
    utility_id: nullableString(raw.utility_id),
    asset_id: nullableString(raw.asset_id),
    repair_id: nullableString(raw.repair_id),
    service_record_id: nullableString(raw.service_record_id),
    vendor_name: nullableString(raw.vendor_name),
    purchase_date: nullableString(raw.purchase_date),
    total_amount: nullableNumber(raw.total_amount),
    tax_amount: nullableNumber(raw.tax_amount),
    currency: normalizeCurrency(raw.currency),
    payment_method: nullableString(raw.payment_method),
    category: enumValue(RECEIPT_CATEGORIES, raw.category, 'other'),
    description: nullableString(raw.description),
    notes: nullableString(raw.notes),
    approval_status: enumValue(RECEIPT_APPROVAL_STATUSES, raw.approval_status, 'approved'),
    source: enumValue(RECEIPT_SOURCES, raw.source, 'manual_review'),
    created_by: nullableString(raw.created_by),
    approved_by: nullableString(raw.approved_by),
    approved_at: nullableString(raw.approved_at),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortReceipts(receipts: ReceiptRow[]) {
  return receipts.slice().sort((a, b) => {
    const aDate = a.purchase_date || a.created_at;
    const bDate = b.purchase_date || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

function formatReceiptError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsSchemaMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('schema cache') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('invalid input value');
  const needsPolicyUpdate =
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy');

  if (needsSchemaMigration) {
    return `Failed to ${action}. Apply ${PHASE_6J_MIGRATION} to your Supabase project, then try again. Original error: ${detail}`;
  }

  if (needsPolicyUpdate) {
    return `Failed to ${action}. Receipt permissions or RLS policies blocked this action. Reapply ${PHASE_6J_MIGRATION} and confirm your account is owner, co_owner, or editor for this property. Original error: ${detail}`;
  }

  return detail;
}

function cleanLinkInput(input: ReceiptLinkInput) {
  return {
    room_id: nullableString(input.room_id),
    utility_id: nullableString(input.utility_id),
    asset_id: nullableString(input.asset_id),
    repair_id: nullableString(input.repair_id),
    service_record_id: nullableString(input.service_record_id)
  };
}

function cleanLinkUpdateInput(input: Partial<ReceiptLinkInput>) {
  const payload: Record<string, string | null> = {};
  if (input.room_id !== undefined) payload.room_id = nullableString(input.room_id);
  if (input.utility_id !== undefined) payload.utility_id = nullableString(input.utility_id);
  if (input.asset_id !== undefined) payload.asset_id = nullableString(input.asset_id);
  if (input.repair_id !== undefined) payload.repair_id = nullableString(input.repair_id);
  if (input.service_record_id !== undefined) payload.service_record_id = nullableString(input.service_record_id);
  return payload;
}

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function getReceiptMimeType(file: File) {
  const browserMime = file.type.toLowerCase();
  if ((RECEIPT_FILE_MIME_TYPES as readonly string[]).includes(browserMime)) {
    return browserMime;
  }

  return RECEIPT_MIME_BY_EXTENSION[getExtension(file.name)] || null;
}

function validateReceiptFile(file: File) {
  if (!file) {
    throw new Error('Choose a receipt file to upload.');
  }

  if (!getReceiptMimeType(file)) {
    throw new Error('Receipt uploads must be PDF, JPEG, PNG, or WebP files.');
  }
}

function buildReceiptPayload(input: ReceiptInput, propertyId: string, userId: string) {
  return {
    property_id: propertyId,
    document_id: nullableString(input.document_id),
    ...cleanLinkInput(input),
    vendor_name: nullableString(input.vendor_name),
    purchase_date: input.purchase_date || null,
    total_amount: input.total_amount ?? null,
    tax_amount: input.tax_amount ?? null,
    currency: normalizeCurrency(input.currency),
    payment_method: nullableString(input.payment_method),
    category: input.category || 'other',
    description: nullableString(input.description),
    notes: nullableString(input.notes),
    approval_status: 'approved' satisfies ReceiptApprovalStatus,
    source: input.source || 'manual_review',
    created_by: userId,
    approved_by: userId,
    approved_at: new Date().toISOString()
  };
}

export function getDemoReceipts() {
  return [] as ReceiptRow[];
}

export function formatReceiptAmount(receipt: ReceiptRow) {
  if (receipt.total_amount === null) {
    return 'Amount not set';
  }

  return `${receipt.currency} ${receipt.total_amount.toFixed(2)}`;
}

export async function getReceiptDataContext(): Promise<ReceiptDataContext> {
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

export async function uploadReceiptDocumentForContext(
  context: ReceiptDataContext,
  input: ReceiptUploadInput
): Promise<DocumentRow> {
  if (context.mode === 'demo') {
    throw new Error('Sign in to upload private receipt files. Demo mode does not persist files.');
  }

  validateReceiptFile(input.file);

  return uploadDocumentForContext(context as DocumentDataContext, {
    file: input.file,
    title: input.title,
    description: input.description,
    document_type: 'receipt',
    visibility: 'private',
    ...cleanLinkInput(input)
  } satisfies DocumentLinkInput & Parameters<typeof uploadDocumentForContext>[1]);
}

export async function getReceiptsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('receipts')
    .select(RECEIPT_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatReceiptError('load receipts', error.message));
  }

  return sortReceipts(((data ?? []) as Partial<ReceiptRow>[]).map(normalizeReceipt));
}

export async function getReceiptsForContext(context: ReceiptDataContext) {
  if (context.mode === 'demo') {
    return getDemoReceipts();
  }

  if (!context.property) {
    return [] as ReceiptRow[];
  }

  return getReceiptsForProperty(context.property.id);
}

export async function getReceiptsForLink(context: ReceiptDataContext, target: ReceiptLinkTarget) {
  if (context.mode === 'demo') {
    return getDemoReceipts();
  }

  if (!context.property) {
    return [] as ReceiptRow[];
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('receipts')
    .select(RECEIPT_SELECT)
    .eq('property_id', context.property.id)
    .eq(target.field, target.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatReceiptError('load linked receipts', error.message));
  }

  return sortReceipts(((data ?? []) as Partial<ReceiptRow>[]).map(normalizeReceipt));
}

export async function approveReceiptForContext(context: ReceiptDataContext, input: ReceiptInput) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to save receipt metadata. Demo mode does not persist receipts.');
  }

  if (!context.user || !context.property) {
    throw new Error('Create or select a property before saving receipts.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  await ensureProfileForUser(context.user);

  const { data, error } = await supabase
    .from('receipts')
    .insert(buildReceiptPayload(input, context.property.id, context.user.id))
    .select(RECEIPT_SELECT)
    .single();

  if (error) {
    throw new Error(formatReceiptError('save approved receipt', error.message));
  }

  return normalizeReceipt(data as Partial<ReceiptRow>);
}

export async function updateReceiptForContext(
  context: ReceiptDataContext,
  receiptId: string,
  input: ReceiptUpdateInput
) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to edit receipt metadata. Demo mode does not persist receipts.');
  }

  if (!context.property) {
    throw new Error('Create or select a property before editing receipts.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const payload: Record<string, unknown> = {};
  if (input.document_id !== undefined) payload.document_id = nullableString(input.document_id);
  if (input.vendor_name !== undefined) payload.vendor_name = nullableString(input.vendor_name);
  if (input.purchase_date !== undefined) payload.purchase_date = input.purchase_date || null;
  if (input.total_amount !== undefined) payload.total_amount = input.total_amount ?? null;
  if (input.tax_amount !== undefined) payload.tax_amount = input.tax_amount ?? null;
  if (input.currency !== undefined) payload.currency = normalizeCurrency(input.currency);
  if (input.payment_method !== undefined) payload.payment_method = nullableString(input.payment_method);
  if (input.category !== undefined) payload.category = input.category;
  if (input.description !== undefined) payload.description = nullableString(input.description);
  if (input.notes !== undefined) payload.notes = nullableString(input.notes);
  Object.assign(payload, cleanLinkUpdateInput(input));

  const { data, error } = await supabase
    .from('receipts')
    .update(payload)
    .eq('id', receiptId)
    .eq('property_id', context.property.id)
    .select(RECEIPT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(formatReceiptError('update receipt', error.message));
  }

  return data ? normalizeReceipt(data as Partial<ReceiptRow>) : null;
}

export async function deleteReceiptForContext(context: ReceiptDataContext, receiptId: string) {
  if (context.mode === 'demo') {
    throw new Error('Sign in to delete receipt metadata. Demo mode does not persist receipts.');
  }

  if (!context.property) {
    throw new Error('Create or select a property before deleting receipts.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('receipts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', receiptId)
    .eq('property_id', context.property.id);

  if (error) {
    throw new Error(formatReceiptError('delete receipt', error.message));
  }
}
