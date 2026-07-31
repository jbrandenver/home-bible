// Reminder-email preferences.
//
// Monthly is the default because the app's own dashboard digest already looks
// 14-60 days ahead, which is a monthly horizon, and because home maintenance
// runs on a seasonal cadence. A weekly email about a gutter clean due in six
// weeks is noise, and noise gets unsubscribed — which kills the only channel
// that brings people back.

import { getCurrentUser } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

export const DIGEST_FREQUENCIES = ['off', 'monthly', 'weekly'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export type DigestPreferences = {
  frequency: DigestFrequency;
  time_zone: string;
  visit_reminders: boolean;
  last_sent_at: string | null;
};

export const DIGEST_FREQUENCY_LABELS: Record<DigestFrequency, string> = {
  off: 'No reminder emails',
  monthly: 'Monthly — a short list of what is coming up',
  weekly: 'Weekly — for a busy or complicated home'
};

const DEFAULTS: DigestPreferences = {
  frequency: 'monthly',
  time_zone: 'UTC',
  visit_reminders: true,
  last_sent_at: null
};

/** The browser knows the zone; the server cannot guess it. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function getDigestPreferences(): Promise<DigestPreferences> {
  const supabase = getSupabaseBrowserClient();
  const user = await getCurrentUser();
  if (!supabase || !user) {
    return DEFAULTS;
  }

  const { data, error } = await supabase
    .from('digest_preferences')
    .select('frequency, time_zone, visit_reminders, last_sent_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return DEFAULTS;
  }

  return {
    frequency: (DIGEST_FREQUENCIES as readonly string[]).includes(data.frequency)
      ? (data.frequency as DigestFrequency)
      : 'monthly',
    time_zone: data.time_zone || 'UTC',
    visit_reminders: data.visit_reminders ?? true,
    last_sent_at: data.last_sent_at ?? null
  };
}

export async function saveDigestPreferences(input: {
  frequency: DigestFrequency;
  visit_reminders: boolean;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const user = await getCurrentUser();
  if (!supabase || !user) {
    throw new Error('Sign in to change reminder emails.');
  }

  const { error } = await supabase.from('digest_preferences').upsert(
    {
      user_id: user.id,
      frequency: input.frequency,
      visit_reminders: input.visit_reminders,
      // Refreshed on every save so a move or a travelling user stays correct.
      time_zone: detectTimeZone()
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(error.message || 'Could not save your reminder settings.');
  }
}
