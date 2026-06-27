import {
  ISSUE_SEVERITIES,
  TREND_FLAG_DETECTED_FROM,
  TREND_FLAG_STATUSES,
  TREND_FLAG_TYPES
} from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_TREND_FLAGS_KEY = 'homeBible.trendFlags';
const PHASE_6G_MIGRATION = 'supabase/migrations/006_phase6g_issues_trend_flags.sql';

export type TrendFlagType = (typeof TREND_FLAG_TYPES)[number];
export type TrendFlagStatus = (typeof TREND_FLAG_STATUSES)[number];
export type TrendFlagDetectedFrom = (typeof TREND_FLAG_DETECTED_FROM)[number];
export type TrendFlagSeverity = (typeof ISSUE_SEVERITIES)[number];
export type TrendFlagDataMode = 'demo' | 'supabase';

export type TrendFlagRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  issue_id: string | null;
  flag_type: TrendFlagType;
  title: string;
  description: string | null;
  severity: TrendFlagSeverity;
  status: TrendFlagStatus;
  detected_from: TrendFlagDetectedFrom;
  first_detected_at: string;
  last_detected_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TrendFlagInput = {
  title: string;
  description?: string | null;
  flag_type?: TrendFlagType;
  severity?: TrendFlagSeverity;
  status?: TrendFlagStatus;
  detected_from?: TrendFlagDetectedFrom;
  first_detected_at?: string | null;
  last_detected_at?: string | null;
  resolved_at?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  issue_id?: string | null;
};

export type TrendFlagDataContext = {
  mode: TrendFlagDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

type RawTrendFlag = Partial<TrendFlagRow>;

const TREND_FLAG_SELECT =
  'id, property_id, room_id, asset_id, utility_id, issue_id, flag_type, title, description, severity, status, detected_from, first_detected_at, last_detected_at, resolved_at, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeTrendFlag(raw: RawTrendFlag): TrendFlagRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: nullableString(raw.room_id),
    asset_id: nullableString(raw.asset_id),
    utility_id: nullableString(raw.utility_id),
    issue_id: nullableString(raw.issue_id),
    flag_type: enumValue(TREND_FLAG_TYPES, raw.flag_type, 'manual_flag'),
    title: raw.title?.trim() || 'Untitled trend flag',
    description: nullableString(raw.description),
    severity: enumValue(ISSUE_SEVERITIES, raw.severity, 'medium'),
    status: enumValue(TREND_FLAG_STATUSES, raw.status, 'active'),
    detected_from: enumValue(TREND_FLAG_DETECTED_FROM, raw.detected_from, 'manual'),
    first_detected_at: raw.first_detected_at || createdAt,
    last_detected_at: nullableString(raw.last_detected_at),
    resolved_at: nullableString(raw.resolved_at),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortTrendFlags(flags: TrendFlagRow[]) {
  return flags.slice().sort((a, b) => {
    const aDate = a.first_detected_at || a.created_at;
    const bDate = b.first_detected_at || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

function writeDemoTrendFlags(flags: TrendFlagRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_TREND_FLAGS_KEY, JSON.stringify(flags));
}

function formatTrendFlagError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  if (!needsMigration) {
    return detail;
  }

  return `Failed to ${action}. Apply ${PHASE_6G_MIGRATION} to your Supabase project, then try again. Original error: ${detail}`;
}

function buildTrendFlagPayload(input: TrendFlagInput, propertyId: string) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Trend flag title is required.');
  }

  return {
    property_id: propertyId,
    room_id: nullableString(input.room_id),
    asset_id: nullableString(input.asset_id),
    utility_id: nullableString(input.utility_id),
    issue_id: nullableString(input.issue_id),
    flag_type: input.flag_type || 'manual_flag',
    title,
    description: nullableString(input.description),
    severity: input.severity || 'medium',
    status: input.status || 'active',
    detected_from: input.detected_from || 'manual',
    first_detected_at: input.first_detected_at || new Date().toISOString(),
    last_detected_at: input.last_detected_at || null,
    resolved_at: input.resolved_at || null
  };
}

export function getDemoTrendFlags() {
  return sortTrendFlags(
    getDemoCollection<RawTrendFlag>(DEMO_TREND_FLAGS_KEY)
      .map(normalizeTrendFlag)
      .filter((flag) => !flag.deleted_at)
  );
}

export async function getTrendFlagDataContext(): Promise<TrendFlagDataContext> {
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

export async function getTrendFlagsForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('trend_flags')
    .select(TREND_FLAG_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatTrendFlagError('load trend flags', error.message));
  }

  return sortTrendFlags(((data ?? []) as RawTrendFlag[]).map(normalizeTrendFlag));
}

export async function getTrendFlagsForContext(context: TrendFlagDataContext) {
  if (context.mode === 'demo') {
    return getDemoTrendFlags();
  }

  if (!context.property) {
    return [] as TrendFlagRow[];
  }

  return getTrendFlagsForProperty(context.property.id);
}

async function getTrendFlagsByColumn(
  context: TrendFlagDataContext,
  column: 'room_id' | 'asset_id' | 'utility_id' | 'issue_id',
  value: string,
  demoFilter: (flag: TrendFlagRow) => boolean,
  errorAction: string
) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoTrendFlags().filter(demoFilter);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('trend_flags')
    .select(TREND_FLAG_SELECT)
    .eq('property_id', context.property.id)
    .eq(column, value)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatTrendFlagError(errorAction, error.message));
  }

  return sortTrendFlags(((data ?? []) as RawTrendFlag[]).map(normalizeTrendFlag));
}

export async function getTrendFlagsForRoom(context: TrendFlagDataContext, roomId: string) {
  return getTrendFlagsByColumn(
    context,
    'room_id',
    roomId,
    (flag) => flag.room_id === roomId,
    'load room trend flags'
  );
}

export async function getTrendFlagsForAsset(context: TrendFlagDataContext, assetId: string) {
  return getTrendFlagsByColumn(
    context,
    'asset_id',
    assetId,
    (flag) => flag.asset_id === assetId,
    'load asset trend flags'
  );
}

export async function getTrendFlagsForUtility(context: TrendFlagDataContext, utilityId: string) {
  return getTrendFlagsByColumn(
    context,
    'utility_id',
    utilityId,
    (flag) => flag.utility_id === utilityId,
    'load utility trend flags'
  );
}

export async function getTrendFlagsForIssue(context: TrendFlagDataContext, issueId: string) {
  return getTrendFlagsByColumn(
    context,
    'issue_id',
    issueId,
    (flag) => flag.issue_id === issueId,
    'load issue trend flags'
  );
}

export async function createTrendFlagForContext(context: TrendFlagDataContext, input: TrendFlagInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const flag = normalizeTrendFlag({
      ...buildTrendFlagPayload(input, demoProperty?.id || ''),
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoTrendFlags([flag, ...getDemoTrendFlags()]);
    return flag;
  }

  if (!context.property) {
    throw new Error('Create a property before adding trend flags.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('trend_flags')
    .insert(buildTrendFlagPayload(input, context.property.id))
    .select(TREND_FLAG_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatTrendFlagError('create trend flag', error?.message));
  }

  return normalizeTrendFlag(data as RawTrendFlag);
}

export async function updateTrendFlagStatusForContext(
  context: TrendFlagDataContext,
  flagId: string,
  status: TrendFlagStatus
) {
  if (context.mode === 'demo') {
    const updated = getDemoTrendFlags().map((flag) =>
      flag.id === flagId
        ? {
            ...flag,
            status,
            resolved_at: status === 'resolved' ? flag.resolved_at || new Date().toISOString() : flag.resolved_at,
            updated_at: new Date().toISOString()
          }
        : flag
    );

    writeDemoTrendFlags(updated);
    return updated.find((flag) => flag.id === flagId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing trend flags.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const payload =
    status === 'resolved'
      ? {
          status,
          resolved_at: new Date().toISOString()
        }
      : { status };

  const { data, error } = await supabase
    .from('trend_flags')
    .update(payload)
    .eq('id', flagId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(TREND_FLAG_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatTrendFlagError('update trend flag', error?.message));
  }

  return normalizeTrendFlag(data as RawTrendFlag);
}

export async function deleteTrendFlagForContext(context: TrendFlagDataContext, flagId: string) {
  if (context.mode === 'demo') {
    writeDemoTrendFlags(getDemoTrendFlags().filter((flag) => flag.id !== flagId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting trend flags.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('trend_flags')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', flagId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatTrendFlagError('delete trend flag', error.message));
  }
}
