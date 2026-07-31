import { formatDataError } from './errors';
import { getSupabaseSetupMessage } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

// Recall matches are written by the check-recalls Edge Function with the
// service role (see migration 024 — users have no INSERT policy). The browser
// only reads them and dismisses them. Supabase-only: demo mode has no cron and
// therefore no recall data.
const RECALL_MIGRATION = 'supabase/migrations/024_recall_monitoring.sql';

// --- Pure model matcher ------------------------------------------------------
//
// KEEP IN SYNC with supabase/functions/check-recalls/index.ts, which carries a
// clearly-marked duplicate of these two functions (the Deno function cannot
// import this workspace package). Tests in tests/recalls-lifespans.test.ts run
// against THIS copy.
//
// The matcher is deliberately conservative: exact containment of the
// normalized model number in the recall text, nothing fuzzier. A missed recall
// (false negative) is recoverable — CPSC re-lists, users can search manually.
// A false positive is a safety notice wrongly attached to someone's appliance,
// which destroys trust in every future notice. So: no fuzzy matching, no
// model-range expansion (a recall listing "models WF45T6000A through
// WF45T6999Z" only matches an asset whose exact model string appears), and
// short model strings are rejected entirely.

/** Uppercase and strip spaces/dashes so "WF45-T6000 A" and "wf45t6000a" agree. */
export function normalizeModelNumber(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * Below this length, normalized model strings ("X5", "200") appear in ordinary
 * prose and recall numbers far too often to be evidence of anything.
 */
export const MIN_MODEL_MATCH_LENGTH = 4;

/**
 * Whether an asset's model number appears in any of the given recall text
 * fragments (product model fields, titles, descriptions). Conservative by
 * design — see the note above.
 */
export function modelMatchesRecallText(
  model: string | null | undefined,
  recallTexts: ReadonlyArray<string | null | undefined>
): boolean {
  const normalizedModel = normalizeModelNumber(model);
  if (normalizedModel.length < MIN_MODEL_MATCH_LENGTH) {
    return false;
  }

  return recallTexts.some((text) => normalizeModelNumber(text).includes(normalizedModel));
}

// --- Data access -------------------------------------------------------------

export type RecallMatchStatus = 'open' | 'dismissed';

export type RecallMatchRow = {
  id: string;
  property_id: string;
  asset_id: string;
  recall_number: string;
  title: string | null;
  hazard: string | null;
  remedy: string | null;
  recall_url: string | null;
  matched_on: string | null;
  status: RecallMatchStatus;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const RECALL_MATCH_SELECT =
  'id, property_id, asset_id, recall_number, title, hazard, remedy, recall_url, matched_on, status, source, created_at, updated_at, deleted_at';

function formatRecallError(action: string, message?: string) {
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
    needsMigration ? `Apply ${RECALL_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  return supabase;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRecallMatch(raw: Partial<RecallMatchRow>): RecallMatchRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || '',
    property_id: raw.property_id || '',
    asset_id: raw.asset_id || '',
    recall_number: raw.recall_number || '',
    title: nullableString(raw.title),
    hazard: nullableString(raw.hazard),
    remedy: nullableString(raw.remedy),
    recall_url: nullableString(raw.recall_url),
    matched_on: nullableString(raw.matched_on),
    status: raw.status === 'dismissed' ? 'dismissed' : 'open',
    source: nullableString(raw.source) || 'cpsc',
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

/** Open and dismissed matches for a property (dismissed stay listed so a
 *  dismissal is visible, not a disappearance). */
export async function listRecallMatches(propertyId: string): Promise<RecallMatchRow[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('recall_matches')
    .select(RECALL_MATCH_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatRecallError('load recall notices', error.message));
  }

  return ((data ?? []) as Partial<RecallMatchRow>[]).map(normalizeRecallMatch);
}

/** Dismiss a match. It stays in the table (and never comes back as 'open' —
 *  the cron inserts with ON CONFLICT DO NOTHING). */
export async function dismissRecallMatch(id: string): Promise<RecallMatchRow> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('recall_matches')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .is('deleted_at', null)
    .select(RECALL_MATCH_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatRecallError('dismiss recall notice', error?.message));
  }

  return normalizeRecallMatch(data as Partial<RecallMatchRow>);
}
