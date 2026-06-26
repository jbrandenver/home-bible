import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './client';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    };
  }

  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    };
  }

  return supabase.auth.signInWithOAuth({
    provider: 'google'
  });
}

export async function signInWithApple() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      data: null,
      error: new Error('Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    };
  }

  return supabase.auth.signInWithOAuth({
    provider: 'apple'
  });
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { error: null };
  }

  return supabase.auth.signOut();
}
