import type { PostgrestError } from '@supabase/supabase-js';
import { getCurrentUserUncached } from '../auth';

/**
 * Reads that survive the gap between one session ending and the next starting.
 *
 * supabase-js resolves the access token per request, and when `getSession()`
 * returns nothing it falls back to the publishable key — so the request goes
 * out as `anon`. Migrations 031/033 revoked anon's grants on the tables
 * holding contractor contacts, costs and private notes, so such a request no
 * longer comes back empty: it comes back as a hard Postgres error, and the
 * page printed "permission denied for table utilities" at the user.
 *
 * That gap is real during a sign-out → sign-in switch. This wrapper closes it:
 * on a permission error it re-checks the session without the cache, retries
 * once if the person is in fact signed in, and otherwise raises something a
 * human can act on.
 */
export class SessionEndedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionEndedError';
  }
}

function isPermissionError(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }
  // 42501 is insufficient_privilege. The message check covers PostgREST
  // surfacing it without the SQLSTATE.
  return error.code === '42501' || /permission denied/i.test(error.message ?? '');
}

export async function guardedRead<T>(
  /** What the user was trying to see, e.g. "your utilities". Used in messages. */
  subject: string,
  run: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>
): Promise<T | null> {
  const first = await run();

  if (!isPermissionError(first.error)) {
    if (first.error) {
      throw new Error(first.error.message || `Failed to load ${subject}.`);
    }
    return first.data;
  }

  // Permission denied. Either the request raced a session change, or this
  // person genuinely may not read this. Ask the auth client, not the cache.
  const user = await getCurrentUserUncached();
  if (!user) {
    throw new SessionEndedError(
      `Your session ended before ${subject} could load. Sign in again to continue.`
    );
  }

  const second = await run();
  if (second.error) {
    // Signed in and still refused: this is not a race. Say so plainly rather
    // than leaking the Postgres text, which names internal tables.
    throw new Error(
      isPermissionError(second.error)
        ? `You do not have access to ${subject}.`
        : second.error.message || `Failed to load ${subject}.`
    );
  }

  return second.data;
}
