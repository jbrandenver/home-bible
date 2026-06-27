import {
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES
} from '@home-bible/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_ISSUES_KEY = 'homeBible.issues';
const PHASE_6G_MIGRATION = 'supabase/migrations/006_phase6g_issues_trend_flags.sql';

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueDataMode = 'demo' | 'supabase';

export type IssueRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  repair_id: string | null;
  issue_type: IssueType;
  title: string;
  description: string | null;
  status: IssueStatus;
  severity: IssueSeverity;
  first_seen_date: string | null;
  last_seen_date: string | null;
  resolved_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type IssueInput = {
  title: string;
  description?: string | null;
  issue_type?: IssueType;
  status?: IssueStatus;
  severity?: IssueSeverity;
  first_seen_date?: string | null;
  last_seen_date?: string | null;
  resolved_date?: string | null;
  notes?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  repair_id?: string | null;
};

export type IssueDataContext = {
  mode: IssueDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

type RawIssue = Partial<IssueRow> & {
  date_found?: string | null;
  resolution_date?: string | null;
  private_notes?: string | null;
  shareable_notes?: string | null;
};

const ISSUE_SELECT =
  'id, property_id, room_id, asset_id, utility_id, repair_id, issue_type, title, description, status, severity, first_seen_date, last_seen_date, resolved_date, notes, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeIssueType(value: unknown): IssueType {
  if (value === 'leak' || value === 'flood' || value === 'plumbing_issue') return 'water_leak';
  if (value === 'electrical_issue') return 'electrical';
  if (value === 'hvac_issue') return 'hvac';
  if (value === 'appliance_issue') return 'appliance';
  if (value === 'structural_issue') return 'structural';
  if (value === 'roof_issue') return 'roof';
  if (value === 'fire' || value === 'security_issue') return 'safety';
  if (value === 'storm_damage') return 'structural';

  return enumValue(ISSUE_TYPES, value, 'general');
}

function normalizeStatus(value: unknown): IssueStatus {
  if (value === 'watching') return 'monitoring';
  if (value === 'archived') return 'dismissed';

  return enumValue(ISSUE_STATUSES, value, 'open');
}

function normalizeIssue(raw: RawIssue): IssueRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const firstSeenDate = nullableString(raw.first_seen_date) || nullableString(raw.date_found);
  const resolvedDate = nullableString(raw.resolved_date) || nullableString(raw.resolution_date);

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: nullableString(raw.room_id),
    asset_id: nullableString(raw.asset_id),
    utility_id: nullableString(raw.utility_id),
    repair_id: nullableString(raw.repair_id),
    issue_type: normalizeIssueType(raw.issue_type),
    title: raw.title?.trim() || 'Untitled issue',
    description: nullableString(raw.description),
    status: normalizeStatus(raw.status),
    severity: enumValue(ISSUE_SEVERITIES, raw.severity, 'medium'),
    first_seen_date: firstSeenDate,
    last_seen_date: nullableString(raw.last_seen_date) || firstSeenDate,
    resolved_date: resolvedDate,
    notes: nullableString(raw.notes) || nullableString(raw.private_notes) || nullableString(raw.shareable_notes),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortIssues(issues: IssueRow[]) {
  return issues.slice().sort((a, b) => {
    const aDate = a.first_seen_date || a.created_at;
    const bDate = b.first_seen_date || b.created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

function writeDemoIssues(issues: IssueRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_ISSUES_KEY, JSON.stringify(issues));
}

function formatIssueError(action: string, message?: string) {
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

function buildIssuePayload(input: IssueInput, propertyId: string) {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Issue title is required.');
  }

  const firstSeenDate = input.first_seen_date || null;
  const resolvedDate = input.resolved_date || null;
  const notes = nullableString(input.notes);

  return {
    property_id: propertyId,
    room_id: nullableString(input.room_id),
    asset_id: nullableString(input.asset_id),
    utility_id: nullableString(input.utility_id),
    repair_id: nullableString(input.repair_id),
    issue_type: input.issue_type || 'general',
    title,
    description: nullableString(input.description),
    status: input.status || 'open',
    severity: input.severity || 'medium',
    first_seen_date: firstSeenDate,
    last_seen_date: input.last_seen_date || firstSeenDate,
    resolved_date: resolvedDate,
    notes,
    date_found: firstSeenDate,
    resolution_date: resolvedDate,
    private_notes: notes,
    shareable_notes: null,
    visibility: 'private'
  };
}

export function getDemoIssues() {
  return sortIssues(
    getDemoCollection<RawIssue>(DEMO_ISSUES_KEY)
      .map(normalizeIssue)
      .filter((issue) => !issue.deleted_at)
  );
}

export async function getIssueDataContext(): Promise<IssueDataContext> {
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

export async function getIssuesForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('issues')
    .select(ISSUE_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatIssueError('load issues', error.message));
  }

  return sortIssues(((data ?? []) as RawIssue[]).map(normalizeIssue));
}

export async function getIssuesForContext(context: IssueDataContext) {
  if (context.mode === 'demo') {
    return getDemoIssues();
  }

  if (!context.property) {
    return [] as IssueRow[];
  }

  return getIssuesForProperty(context.property.id);
}

async function getIssuesByColumn(
  context: IssueDataContext,
  column: 'room_id' | 'asset_id' | 'utility_id' | 'repair_id',
  value: string,
  demoFilter: (issue: IssueRow) => boolean,
  errorAction: string
) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoIssues().filter(demoFilter);
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('issues')
    .select(ISSUE_SELECT)
    .eq('property_id', context.property.id)
    .eq(column, value)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatIssueError(errorAction, error.message));
  }

  return sortIssues(((data ?? []) as RawIssue[]).map(normalizeIssue));
}

export async function getIssuesForRoom(context: IssueDataContext, roomId: string) {
  return getIssuesByColumn(
    context,
    'room_id',
    roomId,
    (issue) => issue.room_id === roomId,
    'load room issues'
  );
}

export async function getIssuesForAsset(context: IssueDataContext, assetId: string) {
  return getIssuesByColumn(
    context,
    'asset_id',
    assetId,
    (issue) => issue.asset_id === assetId,
    'load asset issues'
  );
}

export async function getIssuesForUtility(context: IssueDataContext, utilityId: string) {
  return getIssuesByColumn(
    context,
    'utility_id',
    utilityId,
    (issue) => issue.utility_id === utilityId,
    'load utility issues'
  );
}

export async function getIssuesForRepair(context: IssueDataContext, repairId: string) {
  return getIssuesByColumn(
    context,
    'repair_id',
    repairId,
    (issue) => issue.repair_id === repairId,
    'load repair issues'
  );
}

export async function createIssueForContext(context: IssueDataContext, input: IssueInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const issue = normalizeIssue({
      ...buildIssuePayload(input, demoProperty?.id || ''),
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoIssues([issue, ...getDemoIssues()]);
    return issue;
  }

  if (!context.property) {
    throw new Error('Create a property before adding issues.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('issues')
    .insert(buildIssuePayload(input, context.property.id))
    .select(ISSUE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatIssueError('create issue', error?.message));
  }

  return normalizeIssue(data as RawIssue);
}

export async function updateIssueStatusForContext(
  context: IssueDataContext,
  issueId: string,
  status: IssueStatus
) {
  if (context.mode === 'demo') {
    const updated = getDemoIssues().map((issue) =>
      issue.id === issueId
        ? {
            ...issue,
            status,
            resolved_date: status === 'resolved' ? issue.resolved_date || new Date().toISOString().slice(0, 10) : issue.resolved_date,
            updated_at: new Date().toISOString()
          }
        : issue
    );

    writeDemoIssues(updated);
    return updated.find((issue) => issue.id === issueId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing issues.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const payload =
    status === 'resolved'
      ? {
          status,
          resolved_date: new Date().toISOString().slice(0, 10),
          resolution_date: new Date().toISOString().slice(0, 10)
        }
      : { status };

  const { data, error } = await supabase
    .from('issues')
    .update(payload)
    .eq('id', issueId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(ISSUE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatIssueError('update issue', error?.message));
  }

  return normalizeIssue(data as RawIssue);
}

export async function deleteIssueForContext(context: IssueDataContext, issueId: string) {
  if (context.mode === 'demo') {
    writeDemoIssues(getDemoIssues().filter((issue) => issue.id !== issueId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting issues.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('issues')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', issueId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatIssueError('delete issue', error.message));
  }
}
