import { formatDataError } from './errors';
import {
  CONDITION_RATINGS,
  CONDITION_REPORT_STATUSES,
  CONDITION_REPORT_TYPES,
  createConditionReportEntrySchema,
  createConditionReportSchema,
  type ConditionRating,
  type ConditionReportStatus,
  type ConditionReportType
} from '@home-folder/shared';
import { getSupabaseSetupMessage } from './auth';
import { uploadDocumentForContext, type DocumentDataContext } from './documents';
import { getSupabaseBrowserClient } from './supabase/client';
import type { TenancyRow } from './tenancies';

// Condition reports are the substrate for a California AB 2801 security-deposit
// packet: timestamped photo evidence before tenancy, at move-out before
// repairs, and after repairs. created_at / completed_at are server-set and
// never client-supplied — that is the evidence value. See migration 023.
const PORTFOLIO_MIGRATION = 'supabase/migrations/023_portfolio_foundation.sql';

export type ConditionReportRow = {
  id: string;
  property_id: string;
  tenancy_id: string | null;
  report_type: ConditionReportType;
  status: ConditionReportStatus;
  report_date: string;
  conducted_by: string | null;
  summary: string | null;
  notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ConditionReportEntryRow = {
  id: string;
  report_id: string;
  property_id: string;
  room_id: string | null;
  area_label: string | null;
  condition_rating: ConditionRating | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** The slice of a documents row the packet and detail page need. */
export type ConditionReportDocument = {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  condition_report_entry_id: string | null;
};

export type ConditionReportFormInput = {
  property_id: string;
  tenancy_id?: string | null;
  report_type: ConditionReportType;
  report_date: string;
  conducted_by?: string | null;
  summary?: string | null;
  notes?: string | null;
};


export type ConditionReportEntryFormInput = {
  report_id: string;
  property_id: string;
  room_id?: string | null;
  area_label?: string | null;
  condition_rating?: ConditionRating | null;
  notes?: string | null;
  sort_order?: number;
};

export type ConditionReportEntryPatch = Partial<
  Omit<ConditionReportEntryFormInput, 'report_id' | 'property_id'>
>;

export type ConditionReportPatch = Partial<Omit<ConditionReportFormInput, 'property_id'>>;

/**
 * Why a completed report cannot be changed or removed: its entries, photos,
 * and server-set timestamps are the deposit evidence. Shown wherever an edit
 * or delete is refused so the refusal reads as a reason, not a rule.
 */
export const COMPLETED_REPORT_LOCK_MESSAGE =
  'This report is completed, so it is locked. Its entries, photos, and timestamps are the deposit evidence, and that record has to stay as it was filed.';

/**
 * Draft-only guard for editing and deleting a report. Pure, and enforced again
 * in the database calls below — the UI hides the controls, this makes the rule
 * hold even when it does not.
 */
export function canModifyConditionReport(status: ConditionReportStatus | null | undefined): boolean {
  return status === 'draft';
}

const REPORT_SELECT =
  'id, property_id, tenancy_id, report_type, status, report_date, conducted_by, summary, notes, completed_at, created_by, created_at, updated_at, deleted_at';

const ENTRY_SELECT =
  'id, report_id, property_id, room_id, area_label, condition_rating, notes, sort_order, created_by, created_at, updated_at, deleted_at';

const DOCUMENT_SUMMARY_SELECT = 'id, title, document_type, created_at, condition_report_entry_id';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function nullableEnumValue<T extends readonly string[]>(values: T, value: unknown): T[number] | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

function normalizeReport(raw: Partial<ConditionReportRow>): ConditionReportRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || '',
    tenancy_id: nullableString(raw.tenancy_id),
    report_type: enumValue(CONDITION_REPORT_TYPES, raw.report_type, 'periodic'),
    status: enumValue(CONDITION_REPORT_STATUSES, raw.status, 'draft'),
    report_date: nullableString(raw.report_date) || createdAt.slice(0, 10),
    conducted_by: nullableString(raw.conducted_by),
    summary: nullableString(raw.summary),
    notes: nullableString(raw.notes),
    completed_at: nullableString(raw.completed_at),
    created_by: nullableString(raw.created_by),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function normalizeEntry(raw: Partial<ConditionReportEntryRow>): ConditionReportEntryRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    report_id: raw.report_id || '',
    property_id: raw.property_id || '',
    room_id: nullableString(raw.room_id),
    area_label: nullableString(raw.area_label),
    condition_rating: nullableEnumValue(CONDITION_RATINGS, raw.condition_rating),
    notes: nullableString(raw.notes),
    sort_order: typeof raw.sort_order === 'number' && Number.isFinite(raw.sort_order) ? raw.sort_order : 0,
    created_by: nullableString(raw.created_by),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function formatConditionReportError(action: string, message?: string) {
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

export async function listConditionReports(propertyId: string) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_reports')
    .select(REPORT_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatConditionReportError('load condition reports', error.message));
  }

  return ((data ?? []) as Partial<ConditionReportRow>[]).map(normalizeReport);
}

/**
 * Entry and condition-photo counts per report for the index page, in two
 * queries instead of one per row.
 */
export async function listConditionReportCounts(propertyId: string) {
  const supabase = requireSupabase();

  const [entriesResult, photosResult] = await Promise.all([
    supabase
      .from('condition_report_entries')
      .select('id, report_id')
      .eq('property_id', propertyId)
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('id, condition_report_id')
      .eq('property_id', propertyId)
      .eq('document_type', 'condition_photo')
      .not('condition_report_id', 'is', null)
      .is('deleted_at', null)
  ]);

  if (entriesResult.error) {
    throw new Error(formatConditionReportError('load condition report entries', entriesResult.error.message));
  }
  if (photosResult.error) {
    throw new Error(formatConditionReportError('load condition photos', photosResult.error.message));
  }

  const entryCounts: Record<string, number> = {};
  for (const row of (entriesResult.data ?? []) as { report_id: string }[]) {
    entryCounts[row.report_id] = (entryCounts[row.report_id] || 0) + 1;
  }

  const photoCounts: Record<string, number> = {};
  for (const row of (photosResult.data ?? []) as { condition_report_id: string | null }[]) {
    if (row.condition_report_id) {
      photoCounts[row.condition_report_id] = (photoCounts[row.condition_report_id] || 0) + 1;
    }
  }

  return { entryCounts, photoCounts };
}

export type ConditionReportDetail = {
  report: ConditionReportRow;
  entries: ConditionReportEntryRow[];
  documents: ConditionReportDocument[];
};

export async function getConditionReport(id: string): Promise<ConditionReportDetail | null> {
  const supabase = requireSupabase();

  const { data: reportData, error: reportError } = await supabase
    .from('condition_reports')
    .select(REPORT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (reportError) {
    throw new Error(formatConditionReportError('load condition report', reportError.message));
  }

  if (!reportData) {
    return null;
  }

  const [entriesResult, documentsResult] = await Promise.all([
    supabase
      .from('condition_report_entries')
      .select(ENTRY_SELECT)
      .eq('report_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('documents')
      .select(DOCUMENT_SUMMARY_SELECT)
      .eq('condition_report_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
  ]);

  if (entriesResult.error) {
    throw new Error(formatConditionReportError('load condition report entries', entriesResult.error.message));
  }
  if (documentsResult.error) {
    throw new Error(formatConditionReportError('load condition report documents', documentsResult.error.message));
  }

  return {
    report: normalizeReport(reportData as Partial<ConditionReportRow>),
    entries: ((entriesResult.data ?? []) as Partial<ConditionReportEntryRow>[]).map(normalizeEntry),
    documents: (documentsResult.data ?? []) as ConditionReportDocument[]
  };
}

export async function createConditionReport(input: ConditionReportFormInput) {
  const parsed = createConditionReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Check the report details and try again.');
  }

  const supabase = requireSupabase();
  const values = parsed.data;

  const { data, error } = await supabase
    .from('condition_reports')
    .insert({
      property_id: values.property_id,
      tenancy_id: nullableString(values.tenancy_id),
      report_type: values.report_type,
      report_date: values.report_date,
      conducted_by: nullableString(values.conducted_by),
      summary: nullableString(values.summary),
      notes: nullableString(values.notes)
    })
    .select(REPORT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatConditionReportError('create condition report', error?.message));
  }

  return normalizeReport(data as Partial<ConditionReportRow>);
}

/**
 * Edits the header of a draft report. The `.eq('status', 'draft')` filter is
 * the real gate: a completed report is deposit-dispute evidence, so it stays
 * exactly as it was filed even if a caller asks otherwise.
 */
export async function updateConditionReport(id: string, patch: ConditionReportPatch) {
  const payload: Record<string, unknown> = {};

  if (patch.report_type !== undefined) {
    payload.report_type = enumValue(CONDITION_REPORT_TYPES, patch.report_type, 'periodic');
  }
  if (patch.report_date !== undefined) {
    const reportDate = nullableString(patch.report_date);
    if (!reportDate) {
      throw new Error('A report date is required.');
    }

    payload.report_date = reportDate;
  }
  if (patch.tenancy_id !== undefined) payload.tenancy_id = nullableString(patch.tenancy_id);
  if (patch.conducted_by !== undefined) payload.conducted_by = nullableString(patch.conducted_by);
  if (patch.summary !== undefined) payload.summary = nullableString(patch.summary);
  if (patch.notes !== undefined) payload.notes = nullableString(patch.notes);

  if (Object.keys(payload).length === 0) {
    throw new Error('Nothing to update on this report.');
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_reports')
    .update(payload)
    .eq('id', id)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select(REPORT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(formatConditionReportError('update condition report', error.message));
  }

  if (!data) {
    throw new Error(COMPLETED_REPORT_LOCK_MESSAGE);
  }

  return normalizeReport(data as Partial<ConditionReportRow>);
}

/**
 * Removes a draft report. Same draft-only gate as the edit above, and for the
 * same reason — a completed report is evidence, not a list item.
 */
export async function softDeleteConditionReport(id: string) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_reports')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(formatConditionReportError('remove condition report', error.message));
  }

  if (!data) {
    throw new Error(COMPLETED_REPORT_LOCK_MESSAGE);
  }
}

export async function createEntry(input: ConditionReportEntryFormInput) {
  const parsed = createConditionReportEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Check the entry details and try again.');
  }

  const values = parsed.data;
  if (!nullableString(values.room_id) && !nullableString(values.area_label)) {
    throw new Error('Choose a room or enter an area label for this entry.');
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_report_entries')
    .insert({
      report_id: values.report_id,
      property_id: values.property_id,
      room_id: nullableString(values.room_id),
      area_label: nullableString(values.area_label),
      condition_rating: values.condition_rating || null,
      notes: nullableString(values.notes),
      sort_order: values.sort_order
    })
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatConditionReportError('add condition report entry', error?.message));
  }

  return normalizeEntry(data as Partial<ConditionReportEntryRow>);
}

export async function updateEntry(id: string, patch: ConditionReportEntryPatch) {
  const payload: Record<string, unknown> = {};

  if (patch.room_id !== undefined) payload.room_id = nullableString(patch.room_id);
  if (patch.area_label !== undefined) payload.area_label = nullableString(patch.area_label);
  if (patch.condition_rating !== undefined) {
    payload.condition_rating = nullableEnumValue(CONDITION_RATINGS, patch.condition_rating);
  }
  if (patch.notes !== undefined) payload.notes = nullableString(patch.notes);
  if (patch.sort_order !== undefined && typeof patch.sort_order === 'number') {
    payload.sort_order = patch.sort_order;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Nothing to update on this entry.');
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_report_entries')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select(ENTRY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatConditionReportError('update condition report entry', error?.message));
  }

  return normalizeEntry(data as Partial<ConditionReportEntryRow>);
}

export async function deleteEntry(id: string) {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('condition_report_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatConditionReportError('remove condition report entry', error.message));
  }
}

/**
 * Marks a draft report completed. completed_at is stamped once, here, and is
 * never overwritten — it is part of the evidence trail.
 */
export async function completeReport(id: string) {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('condition_reports')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .select(REPORT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(formatConditionReportError('complete condition report', error.message));
  }

  if (!data) {
    throw new Error('This report is already completed.');
  }

  return normalizeReport(data as Partial<ConditionReportRow>);
}

/**
 * Uploads a photo through the standard compressed document pipeline, then
 * links it to the report (and optionally an entry) as a condition photo.
 * The two condition FKs are newer than the shared upload helper's link
 * fields, so they are stamped in a follow-up update on the same row.
 */
export async function attachConditionPhoto(
  context: DocumentDataContext,
  input: { file: File; title: string; reportId: string; entryId?: string | null }
): Promise<ConditionReportDocument> {
  const uploaded = await uploadDocumentForContext(context, {
    file: input.file,
    title: input.title,
    document_type: 'condition_photo'
  });

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('documents')
    .update({
      condition_report_id: input.reportId,
      condition_report_entry_id: nullableString(input.entryId)
    })
    .eq('id', uploaded.id)
    .select(DOCUMENT_SUMMARY_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      formatConditionReportError('link condition photo to the report', error?.message)
    );
  }

  return data as ConditionReportDocument;
}

// --- Deposit packet (pure; covered by tests/condition-reports.test.ts) ------

/** Entries may be enriched with the room's display name before packet build. */
export type PacketEntry = ConditionReportEntryRow & { room_name?: string | null };

export type DepositPacketEntry = {
  id: string;
  conditionRating: ConditionRating | null;
  notes: string | null;
  photoCount: number;
  recordedAt: string;
};

export type DepositPacketSection = {
  title: string;
  entries: DepositPacketEntry[];
};

export type DepositPacket = {
  propertyNickname: string;
  reportType: ConditionReportType;
  reportDate: string;
  status: ConditionReportStatus;
  conductedBy: string | null;
  summary: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  tenancy: {
    label: string;
    tenantNames: string | null;
    startDate: string | null;
    endDate: string | null;
    depositAmountCents: number | null;
    depositFormatted: string | null;
    depositReturnedOn: string | null;
  } | null;
  sections: DepositPacketSection[];
  totalEntries: number;
  totalPhotos: number;
  unassignedPhotoCount: number;
};

/**
 * Cents → a printable currency string. Locale is pinned so the packet (a legal
 * document) renders identically everywhere, including in tests.
 */
export function formatCentsAsCurrency(cents: number | null | undefined, currency = 'usd'): string | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return null;
  }

  const code = (currency || 'usd').toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
}

/**
 * Assembles the printable security-deposit packet from already-loaded rows.
 * Pure: no I/O, no clocks — every timestamp passes through from the rows, which
 * is exactly what makes the packet usable as evidence.
 */
export function buildDepositPacket(
  report: ConditionReportRow,
  entries: PacketEntry[],
  documents: ConditionReportDocument[],
  propertyNickname: string,
  tenancy: TenancyRow | null
): DepositPacket {
  const conditionPhotos = documents.filter((doc) => doc.document_type === 'condition_photo');

  const photoCountByEntry: Record<string, number> = {};
  for (const photo of conditionPhotos) {
    if (photo.condition_report_entry_id) {
      photoCountByEntry[photo.condition_report_entry_id] =
        (photoCountByEntry[photo.condition_report_entry_id] || 0) + 1;
    }
  }

  const sortedEntries = entries
    .filter((entry) => !entry.deleted_at)
    .slice()
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const sectionOrder: string[] = [];
  const sectionMap: Record<string, DepositPacketSection> = {};

  for (const entry of sortedEntries) {
    const title = entry.area_label?.trim() || entry.room_name?.trim() || 'General';

    if (!sectionMap[title]) {
      sectionMap[title] = { title, entries: [] };
      sectionOrder.push(title);
    }

    sectionMap[title].entries.push({
      id: entry.id,
      conditionRating: entry.condition_rating,
      notes: entry.notes,
      photoCount: photoCountByEntry[entry.id] || 0,
      recordedAt: entry.created_at
    });
  }

  const entryIds = new Set(sortedEntries.map((entry) => entry.id));
  const unassignedPhotoCount = conditionPhotos.filter(
    (photo) => !photo.condition_report_entry_id || !entryIds.has(photo.condition_report_entry_id)
  ).length;

  return {
    propertyNickname,
    reportType: report.report_type,
    reportDate: report.report_date,
    status: report.status,
    conductedBy: report.conducted_by,
    summary: report.summary,
    notes: report.notes,
    createdAt: report.created_at,
    completedAt: report.completed_at,
    tenancy: tenancy
      ? {
          label: tenancy.label,
          tenantNames: tenancy.tenant_names,
          startDate: tenancy.start_date,
          endDate: tenancy.end_date,
          depositAmountCents: tenancy.deposit_amount_cents,
          depositFormatted: formatCentsAsCurrency(tenancy.deposit_amount_cents, tenancy.deposit_currency),
          depositReturnedOn: tenancy.deposit_returned_on
        }
      : null,
    sections: sectionOrder.map((title) => sectionMap[title]),
    totalEntries: sortedEntries.length,
    totalPhotos: conditionPhotos.length,
    unassignedPhotoCount
  };
}
