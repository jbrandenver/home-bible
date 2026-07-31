import { beforeEach, describe, expect, it, vi } from 'vitest';

// A detail page resolves up to eight independent data contexts in parallel and
// each one asks who is signed in. Before the shared lookup that was eight
// network round-trips per page load — a latency and cost problem flagged in
// docs/COST_GOVERNANCE.md. These tests pin the collapsing behaviour, and the
// invalidation that stops it going stale.

let getUserCalls = 0;

vi.mock('../lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getUser: async () => {
        getUserCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: { user: { id: 'user-1' } }, error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  })
}));

const { getCurrentUser, clearCachedUser } = await import('../lib/auth');

describe('shared auth lookup', () => {
  beforeEach(() => {
    getUserCalls = 0;
    clearCachedUser();
  });

  it('serves concurrent callers from a single in-flight request', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => getCurrentUser()));

    expect(getUserCalls).toBe(1);
    expect(results).toHaveLength(8);
    expect(results.every((user) => user?.id === 'user-1')).toBe(true);
  });

  it('reuses the answer briefly, and refetches once invalidated', async () => {
    await getCurrentUser();
    await getCurrentUser();
    expect(getUserCalls).toBe(1);

    // Signing in or out clears the cache, so the next read is authoritative.
    clearCachedUser();
    await getCurrentUser();
    expect(getUserCalls).toBe(2);
  });
});
