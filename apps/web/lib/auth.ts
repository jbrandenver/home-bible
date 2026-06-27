import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase/client';

type AuthResult = {
  data: unknown;
  error: Error | null;
};

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseSetupMessage() {
  return 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your local env.';
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    return sessionData.session.user;
  }

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function ensureProfileForUser(user: User | null) {
  if (!user) {
    return;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const displayName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null;

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: displayName
    },
    {
      onConflict: 'id'
    }
  );
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.signUp({ email, password });
  if (result.data.user) {
    await ensureProfileForUser(result.data.user);
  }

  return {
    data: result.data,
    error: result.error
  };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.data.user) {
    await ensureProfileForUser(result.data.user);
  }

  return {
    data: result.data,
    error: result.error
  };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.signInWithOAuth({ provider: 'google' });

  return {
    data: result.data,
    error: result.error
  };
}

export async function signInWithApple(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.signInWithOAuth({ provider: 'apple' });

  return {
    data: result.data,
    error: result.error
  };
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    callback(null);
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => data.subscription.unsubscribe();
}
