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

