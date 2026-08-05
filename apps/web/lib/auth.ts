import type { User } from '@supabase/supabase-js';
import { isNativeApp, nativeAppleAuthorize } from './native';
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

/**
 * Who is signed in, ignoring the shared cache and asking the auth client
 * directly.
 *
 * `getCurrentUser` answers from a 5-second cache, and during a sign-out →
 * sign-in switch that cache can still hold the `null` recorded a moment
 * earlier. Every caller reads `null` as "signed out", so for a branch that
 * merely renders something that is a harmless flicker — but for a branch that
 * decides *where a person's data is written*, it silently puts their home in
 * browser-local demo storage instead of their account.
 *
 * Use this before any such branch. It costs one round trip; the alternative
 * costs the user their data.
 */
export async function getCurrentUserUncached(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  clearCachedUser();
  const { data } = await withAuthTimeout(supabase.auth.getUser(), 'confirming your sign-in');
  const user = data.user ?? null;
  cachedUser = { user, at: Date.now() };
  return user;
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

  // Deliberately NOT writing `email`. Migration 033 made profiles.email
  // read-only to close an entitlement hijack (a client could set a victim's
  // address and be credited with their Stripe purchase) — it is maintained by
  // the auth_users_sync_profile_email trigger on auth.users instead.
  //
  // An upsert needs UPDATE privilege on every column in its DO UPDATE SET, so
  // including `email` here made the whole statement fail with "permission
  // denied for table profiles" on every single sign-in. The error was
  // discarded unread, so it surfaced only as a profile row that silently
  // stopped tracking full_name.
  // NOT an upsert. PostgREST compiles one into
  //   ON CONFLICT (id) DO UPDATE SET id = excluded.id, ...
  // and `id` carries no UPDATE grant either, so the statement fails whatever
  // else is in the payload. Update first, insert only if no row matched —
  // both need privileges the client actually holds.
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ full_name: displayName })
    .eq('id', user.id)
    .select('id');

  if (updateError) {
    console.error('ensureProfileForUser: profile update failed', updateError.message);
    return;
  }

  if (updated && updated.length > 0) {
    return;
  }

  // No row yet. Accounts created before the auth.users sync trigger existed
  // have no profile row, so this is a real path, not a theoretical one.
  const { error: insertError } = await supabase
    .from('profiles')
    .insert({ id: user.id, full_name: displayName });

  // A concurrent sign-in (or the trigger) may have created it in between;
  // a duplicate-key race here is success, not failure.
  if (insertError && insertError.code !== '23505') {
    console.error('ensureProfileForUser: profile insert failed', insertError.message);
  }
}

export type SignUpResult = AuthResult & {
  /**
   * True when Supabase created the account but issued no session, which is
   * what "Confirm email" being enabled looks like from here. The caller must
   * NOT route into the app: there is no session, so every guarded page would
   * bounce and the person would never learn they have an email waiting.
   */
  needsEmailConfirmation: boolean;
};

export async function signUpWithEmail(
  email: string,
  password: string,
  // Where the confirmation link should land them. Must be inside the redirect
  // allowlist in Supabase → Authentication → URL Configuration.
  confirmRedirectPath = '/welcome'
): Promise<SignUpResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()), needsEmailConfirmation: false };
  }

  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        typeof window === 'undefined'
          ? undefined
          : `${window.location.origin}${confirmRedirectPath}`
    }
  });

  // A session is the only proof the account is usable right now. With email
  // confirmation on, data.user is populated and data.session is null.
  const hasSession = Boolean(result.data.session);

  // Only touch profiles once there is a session. Without auth.uid() the upsert
  // is refused by RLS anyway; the row is created on first signed-in load.
  if (hasSession && result.data.user) {
    await ensureProfileForUser(result.data.user);
  }

  return {
    data: result.data,
    error: result.error,
    needsEmailConfirmation: Boolean(result.data.user) && !hasSession && !result.error
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

// Social providers: Google, and — since the iOS shell (2026-08-05) — Apple.
// Sign in with Apple was removed 2026-08-01 as unnecessary for a web app, but
// Apple's rule that an iOS app offering other social logins must also offer
// Apple's makes it mandatory now that the app ships in the App Store.
//
// A button still renders only when NEXT_PUBLIC_OAUTH_PROVIDERS names the
// provider AND it is enabled in Supabase (Authentication → Providers, with
// real credentials — for Apple, the Services ID/key plus the shell bundle id
// in Authorized Client IDs). A provider enabled on one side only sends the
// visitor to a bare JSON error page, so the gate stays.
export type OAuthProvider = 'google' | 'apple';

export function enabledOAuthProviders(): OAuthProvider[] {
  const raw = process.env.NEXT_PUBLIC_OAUTH_PROVIDERS || '';
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is OAuthProvider => entry === 'google' || entry === 'apple');
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
 * Sign in with Apple. In the iOS shell this is the native Apple sheet — the
 * identity token is exchanged directly for a Supabase session, no browser
 * round-trip. On the web it is the standard OAuth redirect. A cancelled native
 * sheet resolves { data: null, error: null }: nothing happened, show nothing.
 */
export async function signInWithApple(): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: null, error: new Error(getSupabaseSetupMessage()) };
  }

  if (isNativeApp()) {
    const authorization = await nativeAppleAuthorize();
    if (!authorization) {
      return { data: null, error: null };
    }
    const result = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: authorization.identityToken,
      nonce: authorization.rawNonce
    });
    return { data: result.data, error: result.error };
  }

  const result = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${window.location.origin}/dashboard` }
  });

  return { data: result.data, error: result.error };
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

  // Changing a password is how someone takes an account back after a session
  // was left open on a shared machine — so it has to end the other sessions.
  // Without this, the person who lifted the session keeps a valid refresh
  // token and the password change achieves nothing. 'others' keeps the
  // current tab signed in.
  if (!result.error) {
    try {
      await supabase.auth.signOut({ scope: 'others' });
    } catch {
      // Best effort: the password did change, and reporting a sign-out
      // failure here would wrongly read as "your password was not updated".
    }
  }

  return { data: result.data, error: result.error };
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    clearLocalHomeData();
    return;
  }

  await supabase.auth.signOut();

  // Supabase clears its own session, but the app's locally cached home data
  // survived sign-out — on a shared or library machine the next person saw the
  // previous user's rooms and active property. Signing out should leave nothing
  // of the household behind.
  clearLocalHomeData();
}

/** Remove every app-owned localStorage key. Session keys are Supabase's job. */
function clearLocalHomeData() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Two prefixes, historically: demo data uses `homeFolder.`, while the
    // active-property pin uses `home-folder.`. Filtering on only the first
    // left the pin alive across account switches — the next account opened
    // pinned to a home it had no access to, and the whole app read as
    // "view only · shared with me" (founder QA, 2026-08-04).
    const appKeys = Object.keys(window.localStorage).filter(
      (key) => key.startsWith('homeFolder.') || key.startsWith('home-folder.')
    );
    for (const key of appKeys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode, quota, disabled). Sign-out must
    // still complete — the session is already gone at this point.
  }
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
