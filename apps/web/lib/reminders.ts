import { formatDataError } from './errors';
import {
  REMINDER_FREQUENCIES,
  REMINDER_LINKED_TYPES,
  REMINDER_PRIORITIES,
  REMINDER_SOURCES,
  REMINDER_STATUSES,
  REMINDER_TYPES
} from '@home-folder/shared';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from './auth';
import { getDemoActiveProperty, getDemoCollection } from './demoStorage';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getSupabaseBrowserClient } from './supabase/client';

const DEMO_REMINDERS_KEY = 'homeFolder.reminders';
const PHASE_6E_MIGRATION = 'supabase/migrations/004_phase6e_reminders.sql';

export type ReminderType = (typeof REMINDER_TYPES)[number];
export type ReminderLinkedType = (typeof REMINDER_LINKED_TYPES)[number];
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];
export type ReminderPriority = (typeof REMINDER_PRIORITIES)[number];
export type ReminderSource = (typeof REMINDER_SOURCES)[number];
export type ReminderDataMode = 'demo' | 'supabase';

export type ReminderRow = {
  id: string;
  property_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  title: string;
  description: string | null;
  reminder_type: ReminderType;
  due_date: string | null;
  frequency: ReminderFrequency;
  status: ReminderStatus;
  priority: ReminderPriority;
  source: ReminderSource;
  linked_type: ReminderLinkedType | null;
  linked_id: string | null;
  repeat_rule: string | null;
  visibility: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ReminderInput = {
  title: string;
  description?: string | null;
  reminder_type?: ReminderType;
  due_date?: string | null;
  frequency?: ReminderFrequency;
  status?: ReminderStatus;
  priority?: ReminderPriority;
  source?: ReminderSource;
  linked_type?: ReminderLinkedType | null;
  linked_id?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
};

export type ReminderDataContext = {
  mode: ReminderDataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

// Descriptions and repeat rules are NOT selectable from the base table — migration 033
// revoked them so guest-class roles cannot read them with an API client.
// Full-household roles get them merged back in via the get_reminders_private_fields RPC below.
const REMINDER_SELECT =
  'id, property_id, room_id, asset_id, utility_id, title, reminder_type, due_date, frequency, status, priority, source, linked_type, linked_id, visibility, created_at, updated_at, deleted_at';

type ReminderPrivateFields = {
  reminder_id: string;
  description: string | null;
  repeat_rule: string | null;
};

// Merge the privileged columns back into rows. Guests (and any RPC failure)
// simply keep nulls — the fields read as "not recorded", never as an error.
async function mergeReminderPrivateFields<T extends { id: string }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) {
    return rows;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return rows;
  }

  const { data, error } = await supabase.rpc('get_reminders_private_fields', {
    p_reminder_ids: rows.map((row) => row.id)
  });

  if (error || !data) {
    return rows;
  }

  const byId = new Map(
    (data as ReminderPrivateFields[]).map((fields) => [fields.reminder_id, fields])
  );
  return rows.map((row) => {
    const fields = byId.get(row.id);
    if (!fields) {
      return row;
    }
    return {
      ...row,
      description: fields.description,
      repeat_rule: fields.repeat_rule
    };
  });
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function enumValue<T extends readonly string[]>(values: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function normalizeReminderType(value: unknown): ReminderType {
  if (value === 'warranty_expiration') return 'warranty';
  if (value === 'hvac_filter') return 'filter_change';
  if (value === 'custom') return 'general';

  return enumValue(REMINDER_TYPES, value, 'general');
}

function normalizeStatus(value: unknown): ReminderStatus {
  if (value === 'done') return 'completed';
  if (value === 'snoozed') return 'dismissed';

  return enumValue(REMINDER_STATUSES, value, 'open');
}

function normalizeFrequency(value: unknown): ReminderFrequency {
  return enumValue(REMINDER_FREQUENCIES, typeof value === 'string' ? value.toLowerCase() : value, 'none');
}

function normalizePriority(value: unknown): ReminderPriority {
  return enumValue(REMINDER_PRIORITIES, value, 'normal');
}

function normalizeSource(value: unknown): ReminderSource {
  return enumValue(REMINDER_SOURCES, value, 'manual');
}

function normalizeLinkedType(value: unknown): ReminderLinkedType | null {
  return typeof value === 'string' && REMINDER_LINKED_TYPES.includes(value as ReminderLinkedType)
    ? (value as ReminderLinkedType)
    : null;
}

function deriveLinkFromColumns(reminder: {
  property_id?: string | null;
  room_id?: string | null;
  asset_id?: string | null;
  utility_id?: string | null;
  linked_type?: string | null;
  linked_id?: string | null;
}) {
  const linkedType = normalizeLinkedType(reminder.linked_type);
  const linkedId = nullableString(reminder.linked_id);

  if (linkedType && linkedId) {
    return { linked_type: linkedType, linked_id: linkedId };
  }

  if (reminder.room_id) return { linked_type: 'room' as const, linked_id: reminder.room_id };
  if (reminder.asset_id) return { linked_type: 'asset' as const, linked_id: reminder.asset_id };
  if (reminder.utility_id) return { linked_type: 'utility' as const, linked_id: reminder.utility_id };

  return { linked_type: null, linked_id: null };
}

function normalizeReminder(raw: Partial<ReminderRow>): ReminderRow {
  const createdAt = raw.created_at || new Date().toISOString();
  const reminderType = normalizeReminderType(raw.reminder_type);
  const frequency = normalizeFrequency(raw.frequency || raw.repeat_rule);
  const linkedType = normalizeLinkedType(raw.linked_type);
  const linkedId = nullableString(raw.linked_id);
  const roomId = nullableString(raw.room_id || (linkedType === 'room' ? linkedId : null));
  const assetId = nullableString(raw.asset_id || (linkedType === 'asset' ? linkedId : null));
  const utilityId = nullableString(raw.utility_id || (linkedType === 'utility' ? linkedId : null));
  const link = deriveLinkFromColumns({
    property_id: raw.property_id || null,
    room_id: roomId,
    asset_id: assetId,
    utility_id: utilityId,
    linked_type: raw.linked_type || null,
    linked_id: raw.linked_id || null
  });

  return {
    id: raw.id || crypto.randomUUID(),
    property_id: raw.property_id || null,
    room_id: roomId,
    asset_id: assetId,
    utility_id: utilityId,
    title: raw.title?.trim() || 'Untitled reminder',
    description: nullableString(raw.description),
    reminder_type: reminderType,
    due_date: nullableString(raw.due_date),
    frequency,
    status: normalizeStatus(raw.status),
    priority: normalizePriority(raw.priority),
    source: normalizeSource(raw.source || (reminderType === 'warranty' ? 'warranty' : 'manual')),
    linked_type: link.linked_type,
    linked_id: link.linked_id,
    repeat_rule: nullableString(raw.repeat_rule) || frequency,
    visibility: nullableString(raw.visibility),
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function sortReminders(reminders: ReminderRow[]) {
  return reminders.slice().sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;

    if (aDue !== bDue) {
      return aDue - bDue;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function writeDemoReminders(reminders: ReminderRow[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DEMO_REMINDERS_KEY, JSON.stringify(reminders));
}

function formatReminderError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${PHASE_6E_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

type ReminderLinkFields = Pick<
  ReminderInput,
  'linked_type' | 'linked_id' | 'room_id' | 'asset_id' | 'utility_id'
>;

type ReminderLinkColumns = {
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  linked_type: ReminderLinkedType | null;
  linked_id: string | null;
};

// One place decides what the five link columns become, so a reminder created
// with a link and a reminder re-pointed later end up with identical rows.
// Every column is returned every time: re-pointing a room reminder at an asset
// has to clear room_id, or the old link keeps showing up in room views.
function resolveReminderLink(input: ReminderLinkFields, propertyId: string): ReminderLinkColumns {
  let roomId = nullableString(input.room_id);
  let assetId = nullableString(input.asset_id);
  let utilityId = nullableString(input.utility_id);
  let linkedType = input.linked_type || null;
  let linkedId = nullableString(input.linked_id);

  if (linkedType === 'room') {
    roomId = linkedId || roomId;
    assetId = null;
    utilityId = null;
  } else if (linkedType === 'asset') {
    assetId = linkedId || assetId;
    roomId = null;
    utilityId = null;
  } else if (linkedType === 'utility') {
    utilityId = linkedId || utilityId;
    roomId = null;
    assetId = null;
  } else if (linkedType === 'property') {
    linkedId = linkedId || propertyId;
    roomId = null;
    assetId = null;
    utilityId = null;
  }

  if (!linkedType) {
    if (roomId) {
      linkedType = 'room';
      linkedId = roomId;
    } else if (assetId) {
      linkedType = 'asset';
      linkedId = assetId;
    } else if (utilityId) {
      linkedType = 'utility';
      linkedId = utilityId;
    }
  }

  if (linkedType && !linkedId) {
    linkedType = null;
  }

  return {
    room_id: roomId,
    asset_id: assetId,
    utility_id: utilityId,
    linked_type: linkedType,
    linked_id: linkedId
  };
}

function buildReminderPayload(input: ReminderInput, propertyId: string) {
  const link = resolveReminderLink(input, propertyId);

  const reminderType = input.reminder_type || 'general';
  const frequency = input.frequency || 'none';

  return {
    property_id: propertyId,
    room_id: link.room_id,
    asset_id: link.asset_id,
    utility_id: link.utility_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    reminder_type: reminderType,
    due_date: input.due_date || null,
    frequency,
    status: input.status || 'open',
    priority: input.priority || 'normal',
    source: input.source || (reminderType === 'warranty' ? 'warranty' : 'manual'),
    linked_type: link.linked_type,
    linked_id: link.linked_id,
    repeat_rule: frequency
  };
}

function isLinkedTo(reminder: ReminderRow, type: ReminderLinkedType, id: string) {
  if (type === 'room') {
    return reminder.room_id === id || (reminder.linked_type === 'room' && reminder.linked_id === id);
  }

  if (type === 'asset') {
    return reminder.asset_id === id || (reminder.linked_type === 'asset' && reminder.linked_id === id);
  }

  if (type === 'utility') {
    return reminder.utility_id === id || (reminder.linked_type === 'utility' && reminder.linked_id === id);
  }

  return reminder.linked_type === 'property' && reminder.linked_id === id;
}

export function getDemoReminders() {
  return sortReminders(
    getDemoCollection<Partial<ReminderRow>>(DEMO_REMINDERS_KEY)
      .map(normalizeReminder)
      .filter((reminder) => !reminder.deleted_at)
  );
}

export async function getReminderDataContext(): Promise<ReminderDataContext> {
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

export async function getRemindersForProperty(propertyId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatReminderError('load reminders', error.message));
  }

  const merged = await mergeReminderPrivateFields(
    (data ?? []) as Array<Partial<ReminderRow> & { id: string }>
  );
  return sortReminders(merged.map(normalizeReminder));
}

export async function getRemindersForContext(context: ReminderDataContext) {
  if (context.mode === 'demo') {
    return getDemoReminders();
  }

  if (!context.property) {
    return [] as ReminderRow[];
  }

  return getRemindersForProperty(context.property.id);
}

export async function getRemindersForRoom(context: ReminderDataContext, roomId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoReminders().filter((reminder) => isLinkedTo(reminder, 'room', roomId));
  }

  const reminders = await getRemindersForProperty(context.property.id);
  return reminders.filter((reminder) => isLinkedTo(reminder, 'room', roomId));
}

export async function getRemindersForAsset(context: ReminderDataContext, assetId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoReminders().filter((reminder) => isLinkedTo(reminder, 'asset', assetId));
  }

  const reminders = await getRemindersForProperty(context.property.id);
  return reminders.filter((reminder) => isLinkedTo(reminder, 'asset', assetId));
}

export async function getRemindersForUtility(context: ReminderDataContext, utilityId: string) {
  if (context.mode === 'demo' || !context.property) {
    return getDemoReminders().filter((reminder) => isLinkedTo(reminder, 'utility', utilityId));
  }

  const reminders = await getRemindersForProperty(context.property.id);
  return reminders.filter((reminder) => isLinkedTo(reminder, 'utility', utilityId));
}

export async function createReminderForContext(context: ReminderDataContext, input: ReminderInput) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const reminder = normalizeReminder({
      ...buildReminderPayload(input, demoProperty?.id || ''),
      id: crypto.randomUUID(),
      property_id: demoProperty?.id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    writeDemoReminders([reminder, ...getDemoReminders()]);
    return reminder;
  }

  if (!context.property) {
    throw new Error('Create a property before adding reminders.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert(buildReminderPayload(input, context.property.id))
    .select(REMINDER_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatReminderError('create reminder', error?.message));
  }

  const [merged] = await mergeReminderPrivateFields([data as Partial<ReminderRow> & { id: string }]);
  return normalizeReminder(merged);
}

/**
 * Everything about a reminder that can be corrected later. Only the keys you
 * pass are written, so a caller can change one field without resetting the
 * rest; passing any link field rewrites the whole link.
 */
export type ReminderUpdateInput = Partial<ReminderInput>;

type ReminderUpdatePayload = Partial<{
  title: string;
  description: string | null;
  reminder_type: ReminderType;
  due_date: string | null;
  frequency: ReminderFrequency;
  repeat_rule: string;
  status: ReminderStatus;
  priority: ReminderPriority;
  source: ReminderSource;
  room_id: string | null;
  asset_id: string | null;
  utility_id: string | null;
  linked_type: ReminderLinkedType | null;
  linked_id: string | null;
}>;

function buildReminderUpdatePayload(patch: ReminderUpdateInput, propertyId: string): ReminderUpdatePayload {
  const payload: ReminderUpdatePayload = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) {
      throw new Error('A reminder needs a title.');
    }
    payload.title = title;
  }

  if (patch.description !== undefined) {
    payload.description = patch.description?.trim() || null;
  }

  if (patch.reminder_type !== undefined) {
    payload.reminder_type = patch.reminder_type;
  }

  if (patch.due_date !== undefined) {
    payload.due_date = nullableString(patch.due_date);
  }

  if (patch.frequency !== undefined) {
    // repeat_rule mirrors frequency on create; keep them in step on edit too,
    // or a reminder saved once would report two different repeat schedules.
    payload.frequency = patch.frequency;
    payload.repeat_rule = patch.frequency;
  }

  if (patch.status !== undefined) {
    payload.status = patch.status;
  }

  if (patch.priority !== undefined) {
    payload.priority = patch.priority;
  }

  if (patch.source !== undefined) {
    payload.source = patch.source;
  }

  const touchesLink =
    patch.linked_type !== undefined ||
    patch.linked_id !== undefined ||
    patch.room_id !== undefined ||
    patch.asset_id !== undefined ||
    patch.utility_id !== undefined;

  if (touchesLink) {
    Object.assign(payload, resolveReminderLink(patch, propertyId));
  }

  return payload;
}

export async function updateReminderForContext(
  context: ReminderDataContext,
  reminderId: string,
  patch: ReminderUpdateInput
) {
  const now = new Date().toISOString();

  if (context.mode === 'demo') {
    const demoProperty = getDemoActiveProperty();
    const current = getDemoReminders().find((reminder) => reminder.id === reminderId);

    if (!current) {
      return null;
    }

    const payload = buildReminderUpdatePayload(patch, demoProperty?.id || current.property_id || '');
    const updated = normalizeReminder({
      ...current,
      ...payload,
      id: current.id,
      property_id: current.property_id,
      created_at: current.created_at,
      updated_at: now
    });

    writeDemoReminders(
      getDemoReminders().map((reminder) => (reminder.id === reminderId ? updated : reminder))
    );

    return updated;
  }

  if (!context.property) {
    throw new Error('Create a property before editing reminders.');
  }

  const payload = buildReminderUpdatePayload(patch, context.property.id);

  if (Object.keys(payload).length === 0) {
    // Nothing was actually changed; don't spend a write on it.
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('reminders')
    .update(payload)
    .eq('id', reminderId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(REMINDER_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatReminderError('update reminder', error?.message));
  }

  const [merged] = await mergeReminderPrivateFields([data as Partial<ReminderRow> & { id: string }]);
  return normalizeReminder(merged);
}

export async function updateReminderStatusForContext(
  context: ReminderDataContext,
  reminderId: string,
  status: ReminderStatus
) {
  if (context.mode === 'demo') {
    const updated = getDemoReminders().map((reminder) =>
      reminder.id === reminderId
        ? {
            ...reminder,
            status,
            updated_at: new Date().toISOString()
          }
        : reminder
    );

    writeDemoReminders(updated);
    return updated.find((reminder) => reminder.id === reminderId) || null;
  }

  if (!context.property) {
    throw new Error('Create a property before editing reminders.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('reminders')
    .update({ status })
    .eq('id', reminderId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select(REMINDER_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatReminderError('update reminder', error?.message));
  }

  const [merged] = await mergeReminderPrivateFields([data as Partial<ReminderRow> & { id: string }]);
  return normalizeReminder(merged);
}

export async function deleteReminderForContext(context: ReminderDataContext, reminderId: string) {
  if (context.mode === 'demo') {
    writeDemoReminders(getDemoReminders().filter((reminder) => reminder.id !== reminderId));
    return;
  }

  if (!context.property) {
    throw new Error('Create a property before deleting reminders.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { error } = await supabase
    .from('reminders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reminderId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(formatReminderError('delete reminder', error.message));
  }
}
