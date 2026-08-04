import { beforeEach, describe, expect, it, vi } from 'vitest';

// Turning on "Confirm email" in Supabase changes what signUp returns: the user
// is created but no session is issued. The sign-up page used to route into
// /welcome unconditionally, which under that setting drops a brand new user on
// an auth-guarded page with no hint that an email is waiting — a silent
// dead-end at the very top of the funnel.
//
// These tests pin the branch in both directions, because the app has to behave
// correctly whether or not the dashboard toggle is on.

// These run in the node environment, where there is no window. signUp builds
// the confirmation link from window.location.origin, so stand one up rather
// than reshaping the source to suit the test.
(globalThis as { window?: unknown }).window = {
  location: { origin: 'https://ourhomefolder.com' }
};

type SignUpArgs = {
  email: string;
  password: string;
  options?: { emailRedirectTo?: string };
};

let lastSignUpArgs: SignUpArgs | null = null;
let signUpResponse: unknown = null;
let profileUpserts = 0;

vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signUp: async (args: SignUpArgs) => {
        lastSignUpArgs = args;
        return signUpResponse;
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    // Mirrors the real write path: UPDATE ... .eq().select(), falling back to
    // INSERT when no row matched. profiles.id and .email carry no UPDATE grant
    // (migration 033), so an upsert would fail against the live database —
    // this mock must not offer one, or the test would pass on a shape that
    // 403s in production.
    from: () => ({
      update: () => ({
        eq: () => ({
          select: async () => {
            profileUpserts += 1;
            return { data: [{ id: 'u1' }], error: null };
          }
        })
      }),
      insert: async () => {
        profileUpserts += 1;
        return { data: null, error: null };
      }
    })
  })
}));

const { signUpWithEmail } = await import('../lib/auth');

describe('sign-up under email confirmation', () => {
  beforeEach(() => {
    lastSignUpArgs = null;
    profileUpserts = 0;
  });

  it('flags confirmation when a user comes back without a session', async () => {
    signUpResponse = { data: { user: { id: 'u1', email: 'a@b.com' }, session: null }, error: null };

    const result = await signUpWithEmail('a@b.com', 'password123');

    expect(result.needsEmailConfirmation).toBe(true);
    expect(result.error).toBeNull();
  });

  it('does not touch profiles without a session', async () => {
    signUpResponse = { data: { user: { id: 'u1', email: 'a@b.com' }, session: null }, error: null };

    await signUpWithEmail('a@b.com', 'password123');

    // RLS would refuse the write anyway (no auth.uid()); the row is created on
    // the first signed-in load instead.
    expect(profileUpserts).toBe(0);
  });

  it('signs straight in when confirmation is off', async () => {
    signUpResponse = {
      data: { user: { id: 'u1', email: 'a@b.com' }, session: { access_token: 't' } },
      error: null
    };

    const result = await signUpWithEmail('a@b.com', 'password123');

    expect(result.needsEmailConfirmation).toBe(false);
    expect(profileUpserts).toBe(1);
  });

  it('never claims confirmation is pending when sign-up failed', async () => {
    signUpResponse = { data: { user: null, session: null }, error: new Error('User already registered') };

    const result = await signUpWithEmail('a@b.com', 'password123');

    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('sends the confirmation link back to where they were headed', async () => {
    signUpResponse = { data: { user: { id: 'u1' }, session: null }, error: null };

    // A transfer recipient sent here from /claim must not lose their place
    // just because the account now takes a detour through their inbox.
    await signUpWithEmail('a@b.com', 'password123', '/claim?code=abc');

    expect(lastSignUpArgs?.options?.emailRedirectTo).toContain('/claim?code=abc');
  });
});
