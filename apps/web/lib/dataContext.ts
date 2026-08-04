import type { User } from '@supabase/supabase-js';
import { getCurrentUser, isSupabaseConfigured, getCurrentUserUncached } from './auth';
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

  // A cached `null` from a moment earlier -- mid sign-out -> sign-in -- used to
  // read as "signed out", and signed-out means demo mode, which means this
  // person's next save goes to browser storage instead of their account and
  // is quietly lost. Confirm against the auth client before concluding that.
  const user = (await getCurrentUser()) ?? (await getCurrentUserUncached());
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

