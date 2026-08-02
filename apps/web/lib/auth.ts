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

export function formatAuthError(error: Error) {
  const message = error.message || 'Authentication failed. Please try again.';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('rate') || lowerMessage.includes('security purposes')) {
    return 'Too many auth attempts. Please wait a minute before trying again.';
  }

  if (lowerMessage.includes('invalid login') || lowerMessage.includes('invalid credentials')) {
    return 'Email or password was not recognized. Check your details and try again.';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  return message;
}

const AUTH_TIMEOUT_MS = 12_000;

/**
 * Bound any auth call so a stalled one cannot hang a page forever.
 *
 * A deadline on the HTTP client is not enough: the auth client also serialises
 * calls behind a navigator lock, and a stall there never reaches fetch. Pages
 * were left showing "Loading..." indefinitely with their primary action
 * disabled and no way to find out why.
 */
function withAuthTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    operation,
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Timed out while ${label}. Check your connection and try again.`)),
        AUTH_TIMEOUT_MS
      );
    })
  ]);
}

// A detail page resolves up to eight independent data contexts in parallel,
// and each one used to call getUser() separately — eight network round-trips
// for one answer that cannot change mid-render. Concurrent callers now share a
// single in-flight request, and the answer is reused briefly afterwards.
// Cleared immediately on any auth state change, so signing out is never stale.
const USER_CACHE_MS = 5_000;

let cachedUser: { user: User | null; at: number } | null = null;
let inFlightUser: Promise<User | null> | null = null;

export function clearCachedUser() {
  cachedUser = null;
  inFlightUser = null;
}

// Other modules cache things keyed to the signed-in user. They register here
// rather than auth importing them, which would make auth <-> properties a
// circular import that only works by accident of hoisting.
const cacheInvalidators = new Set<() => void>();

export function registerCacheInvalidator(invalidate: () => void) {
  cacheInvalidators.add(invalidate);
  return () => cacheInvalidators.delete(invalidate);
}

function invalidateUserScopedCaches() {
  clearCachedUser();
  for (const invalidate of cacheInvalidators) {
    invalidate();
  }
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  if (cachedUser && Date.now() - cachedUser.at < USER_CACHE_MS) {
    return cachedUser.user;
  }

  if (inFlightUser) {
    return inFlightUser;
  }

  // Deliberately throws rather than returning null on timeout: null means
  // "signed out" to every caller, and quietly downgrading a signed-in user to
  // demo data is precisely the failure this is meant to prevent.
  inFlightUser = withAuthTimeout(supabase.auth.getUser(), 'checking your sign-in')
    .then(({ data }) => {
      const user = data.user ?? null;
      cachedUser = { user, at: Date.now() };
      return user;
    })
    .finally(() => {
      inFlightUser = null;
    });

  return inFlightUser;
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

// Google is the only social provider. Sign in with Apple was removed
// 2026-08-01: it requires a paid Apple Developer account, and Apple's rule
// that an iOS app offering other social logins must also offer Apple's does
// not apply to a web app. Re-adding it means an `'google' | 'apple'` union
// here, a second button on both auth pages, and the Supabase provider.
//
// The button still renders only when NEXT_PUBLIC_OAUTH_PROVIDERS names google
// AND the provider is enabled in Supabase (Authentication → Providers, with
// real Google Cloud credentials). A provider enabled on one side only sends
// the visitor to a bare JSON error page, so the gate stays.
export function enabledOAuthProviders(): Array<'google'> {
  const raw = process.env.NEXT_PUBLIC_OAUTH_PROVIDERS || '';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is 'google' => entry === 'google');
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: 'google',
    // Land back in the app after the provider round-trip. The URL must also be
    // listed in Supabase → Authentication → URL Configuration → Redirect URLs.
    options: { redirectTo: `${window.location.origin}/dashboard` }
  });

  return {
    data: result.data,
    error: result.error
  };
}

/**
 * Send the password-reset email. Always resolves without revealing whether the
 * address has an account — the page copy stays "if an account exists" either
 * way, so this is not an enumeration oracle.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  return { data: result.data, error: result.error };
}

/** Set a new password for the recovery session opened by the emailed link. */
export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  const result = await withAuthTimeout(
    supabase.auth.updateUser({ password }),
    'updating your password'
  );

  return { data: result.data, error: result.error };
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
    // Any change invalidates the shared cache before listeners react to it.
    invalidateUserScopedCaches();
    callback(session?.user ?? null);
  });

  return () => data.subscription.unsubscribe();
}
