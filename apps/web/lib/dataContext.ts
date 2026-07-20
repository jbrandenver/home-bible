import type { User } from '@supabase/supabase-js';
import { getCurrentUser, isSupabaseConfigured } from './auth';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';

export type DataMode = 'demo' | 'supabase';

export type ResolvedDataContext = {
  mode: DataMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

export async function resolveDataContext(): Promise<ResolvedDataContext> {
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

export type ListOptions = {
  limit?: number;
  offset?: number;
};

export function applyRange<T extends { range(from: number, to: number): T }>(
  query: T,
  options: ListOptions = {}
) {
  const limit = options.limit;
  const offset = options.offset ?? 0;

  if (!limit || limit <= 0) {
    return query;
  }

  return query.range(offset, offset + limit - 1);
}

export function requireSupabaseProperty(context: ResolvedDataContext, action: string) {
  if (context.mode === 'demo') {
    throw new Error(`Sign in to ${action}. Demo mode only persists data in this browser.`);
  }

  if (!context.property) {
    throw new Error(`Create or select a property before you ${action}.`);
  }

  return context.property;
}
