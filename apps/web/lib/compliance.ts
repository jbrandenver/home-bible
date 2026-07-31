import {
  createComplianceObligationSchema,
  type ComplianceObligationType,
  type CreateComplianceObligationInput
} from '@home-folder/shared';
import { getSupabaseSetupMessage } from './auth';
import { formatDataError } from './errors';
import { getSupabaseBrowserClient } from './supabase/client';

// Compliance obligations are a Supabase-only feature (landlord tier): the
// page gates on the resolved data context, so this module talks straight to
// Supabase — RLS scopes every read/write to properties the signed-in user
// holds an editor seat on (migration 023).

const PORTFOLIO_MIGRATION = 'supabase/migrations/023_portfolio_foundation.sql';

export type ComplianceObligationRow = {
  id: string;
  property_id: string;
  title: string;
  authority: string | null;
  jurisdiction: string | null;
  obligation_type: ComplianceObligationType;
  frequency_months: number | null;
  next_due: string | null;
  last_completed_on: string | null;
  retention_years: number | null;
  reference_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ComplianceObligationPatch = Partial<Omit<CreateComplianceObligationInput, 'property_id'>>;

export type ObligationStatus = 'overdue' | 'due_soon' | 'scheduled' | 'no_date';

/** An obligation counts as "due soon" when it is due within this many days. */
export const DUE_SOON_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

const OBLIGATION_SELECT =
  'id, property_id, title, authority, jurisdiction, obligation_type, frequency_months, next_due, last_completed_on, retention_years, reference_url, notes, created_by, created_at, updated_at, deleted_at';

const updateComplianceObligationSchema = createComplianceObligationSchema
  .omit({ property_id: true })
  .partial();

// --- Pure helpers (unit-tested; no I/O, no clock) ---------------------------

function parseIsoDateUtc(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Add `frequencyMonths` months to a completion date (YYYY-MM-DD), clamping to
 * the end of the target month: completed Jan 31 + 1 month = Feb 28 (or Feb 29
 * in a leap year), never Mar 2/3.
 */
export function advanceNextDue(completedOnIso: string, frequencyMonths: number): string {
  const parts = parseIsoDateUtc(completedOnIso);
  if (!parts) {
    throw new Error(`Invalid completion date: ${completedOnIso}`);
  }

  const months = Math.trunc(frequencyMonths);
  const totalMonths = parts.month - 1 + months;
  const targetYear = parts.year + Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;

  // Day 0 of the following month = last day of the target month.
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const targetDay = Math.min(parts.day, daysInTargetMonth);

  return `${targetYear}-${pad2(targetMonthIndex + 1)}-${pad2(targetDay)}`;
}

/**
 * Classify an obligation's due date relative to `todayIso` (both YYYY-MM-DD):
 * past = 'overdue', within DUE_SOON_DAYS (inclusive) = 'due_soon', further out
 * = 'scheduled', missing/unparseable = 'no_date'.
 */
export function obligationStatus(nextDueIso: string | null, todayIso: string): ObligationStatus {
  if (!nextDueIso) {
    return 'no_date';
  }

  const due = parseIsoDateUtc(nextDueIso);
  const today = parseIsoDateUtc(todayIso);
  if (!due || !today) {
    return 'no_date';
  }

  const dueMs = Date.UTC(due.year, due.month - 1, due.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const days = Math.round((dueMs - todayMs) / DAY_MS);

  if (days < 0) {
    return 'overdue';
  }

  if (days <= DUE_SOON_DAYS) {
    return 'due_soon';
  }

  return 'scheduled';
}

// --- Supabase reads and writes ----------------------------------------------

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  return supabase;
}

function formatComplianceError(action: string, message?: string) {
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

function firstIssueMessage(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (!issue) {
    return 'The obligation details are invalid.';
  }

  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildObligationPayload(parsed: CreateComplianceObligationInput) {
  return {
    property_id: parsed.property_id,
    title: parsed.title.trim(),
    authority: trimmedOrNull(parsed.authority),
    jurisdiction: trimmedOrNull(parsed.jurisdiction),
    obligation_type: parsed.obligation_type,
    frequency_months: parsed.frequency_months ?? null,
    next_due: trimmedOrNull(parsed.next_due),
    last_completed_on: trimmedOrNull(parsed.last_completed_on),
    retention_years: parsed.retention_years ?? null,
    reference_url: trimmedOrNull(parsed.reference_url),
    notes: trimmedOrNull(parsed.notes)
  };
}

export async function listComplianceObligations(propertyId: string): Promise<ComplianceObligationRow[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('compliance_obligations')
    .select(OBLIGATION_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('next_due', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  if (error) {
    throw new Error(formatComplianceError('load compliance obligations', error.message));
  }

  return (data ?? []) as ComplianceObligationRow[];
}

export async function createComplianceObligation(
  input: CreateComplianceObligationInput
): Promise<ComplianceObligationRow> {
  const parsed = createComplianceObligationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(firstIssueMessage(parsed.error));
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('compliance_obligations')
    .insert(buildObligationPayload(parsed.data))
    .select(OBLIGATION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatComplianceError('save the compliance obligation', error?.message));
  }

  return data as ComplianceObligationRow;
}

export async function updateComplianceObligation(
  id: string,
  patch: ComplianceObligationPatch
): Promise<ComplianceObligationRow> {
  const parsed = updateComplianceObligationSchema.safeParse(patch);
  if (!parsed.success) {
    throw new Error(firstIssueMessage(parsed.error));
  }

  // Only touch the columns the caller actually sent; a partial parse drops
  // absent keys, so iterating parsed.data preserves "unchanged" semantics.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) {
      continue;
    }

    payload[key] = typeof value === 'string' ? trimmedOrNull(value) : value;
  }

  if ('title' in payload && payload.title === null) {
    throw new Error('title: A title is required');
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('Nothing to update.');
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('compliance_obligations')
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null)
    .select(OBLIGATION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatComplianceError('update the compliance obligation', error?.message));
  }

  return data as ComplianceObligationRow;
}

export async function softDeleteComplianceObligation(id: string): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase
    .from('compliance_obligations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatComplianceError('remove the compliance obligation', error.message));
  }
}

/**
 * Record a completion: stamps last_completed_on and advances next_due.
 * Recurring obligations (frequency_months set) advance to completion date +
 * frequency; one-time obligations keep a future next_due if one is already
 * scheduled past the completion date, and otherwise clear it so a satisfied
 * deadline stops reading as overdue.
 */
export async function markObligationCompleted(
  id: string,
  completedOnIso: string,
  frequencyMonths: number | null,
  currentNextDue: string | null
): Promise<ComplianceObligationRow> {
  let nextDue: string | null;
  if (frequencyMonths && frequencyMonths >= 1) {
    nextDue = advanceNextDue(completedOnIso, frequencyMonths);
  } else if (currentNextDue && currentNextDue > completedOnIso) {
    nextDue = currentNextDue;
  } else {
    nextDue = null;
  }

  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('compliance_obligations')
    .update({ last_completed_on: completedOnIso, next_due: nextDue })
    .eq('id', id)
    .is('deleted_at', null)
    .select(OBLIGATION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatComplianceError('mark the obligation completed', error?.message));
  }

  return data as ComplianceObligationRow;
}
