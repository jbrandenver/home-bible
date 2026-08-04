import { beforeEach, describe, expect, it, vi } from 'vitest';

// The bug this guards against, in full:
//
// supabase-js resolves the access token per request and falls back to the
// publishable key when getSession() returns nothing, so a read issued during
// the gap between one session ending and the next starting goes out as `anon`.
// Migrations 031/033 revoked anon's grants on the tables holding contractor
// contacts, costs and private notes — so instead of coming back empty, that
// read comes back as a hard Postgres error and the dashboard printed
// "permission denied for table utilities" straight at the user.
//
// These tests pin the three outcomes that matter: a race recovers silently, a
// genuinely ended session says so in words, and a real authorization failure
// never leaks the Postgres text (which names internal tables).

let currentUser: { id: string } | null = { id: 'u1' };
let uncachedCalls = 0;

vi.mock('../lib/auth', () => ({
  getCurrentUserUncached: async () => {
    uncachedCalls += 1;
    return currentUser;
  }
}));

const { guardedRead, SessionEndedError } = await import('../lib/supabase/guardedRead');

const denied = { code: '42501', message: 'permission denied for table utilities' } as never;

describe('guardedRead', () => {
  beforeEach(() => {
    currentUser = { id: 'u1' };
    uncachedCalls = 0;
  });

  it('passes a successful read straight through', async () => {
    const rows = await guardedRead('your utilities', async () => ({ data: [{ id: 'a' }], error: null }));
    expect(rows).toEqual([{ id: 'a' }]);
    expect(uncachedCalls).toBe(0); // no reason to consult auth
  });

  it('retries once and succeeds when the read raced a session change', async () => {
    let attempt = 0;
    const rows = await guardedRead('your utilities', async () => {
      attempt += 1;
      return attempt === 1 ? { data: null, error: denied } : { data: [{ id: 'a' }], error: null };
    });

    expect(rows).toEqual([{ id: 'a' }]);
    expect(attempt).toBe(2);
    expect(uncachedCalls).toBe(1); // confirmed the session before retrying
  });

  it('reports an ended session in words rather than retrying forever', async () => {
    currentUser = null;
    let attempt = 0;

    await expect(
      guardedRead('your utilities', async () => {
        attempt += 1;
        return { data: null, error: denied };
      })
    ).rejects.toBeInstanceOf(SessionEndedError);

    expect(attempt).toBe(1); // did not pointlessly retry while signed out
  });

  it('never leaks the Postgres message when the refusal is genuine', async () => {
    let attempt = 0;
    const promise = guardedRead('your utilities', async () => {
      attempt += 1;
      return { data: null, error: denied };
    });

    await expect(promise).rejects.toThrow('You do not have access to your utilities.');
    expect(attempt).toBe(2);
    await expect(promise).rejects.not.toThrow(/permission denied for table/);
  });

  it('passes non-permission errors through unchanged', async () => {
    await expect(
      guardedRead('your utilities', async () => ({
        data: null,
        error: { code: 'PGRST116', message: 'something else broke' } as never
      }))
    ).rejects.toThrow('something else broke');
    expect(uncachedCalls).toBe(0);
  });
});
