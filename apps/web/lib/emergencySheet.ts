/**
 * A last-known-good copy of the emergency page, kept on the device.
 *
 * The emergency page is the one screen whose whole reason to exist is the
 * moment things have gone wrong — water coming through a ceiling, a gas smell,
 * a breaker that will not reset. Those moments correlate with exactly the
 * conditions that break a normal page load: no signal in a basement, a power
 * cut that took the router with it, a phone on 2%.
 *
 * The service worker cannot solve this. It deliberately never caches page HTML
 * (see public/sw.js — v1 did, and launch QA saw flashes of stale content), and
 * even if it did, the shutoff locations live in Supabase, which is cross-origin
 * and untouched by the worker. So the *data* is what has to be cached, and this
 * is where that happens.
 *
 * Privacy: emergency_notes is a private, trusted-household-only field (033
 * withholds it from guest roles and merges it back through an RPC). A copy of
 * it sitting in localStorage would outlive the session, so the key carries the
 * `home-folder.` prefix that lib/auth.ts::clearLocalHomeData wipes on every
 * sign-out, and it is scoped per user id so a crash that skips sign-out still
 * cannot show one account another's shutoffs.
 */

const KEY_PREFIX = 'home-folder.emergency-sheet.v1.';

// A device holding several homes should not lose the sheet for one when it
// saves another, but an unbounded cache of every property ever opened is not
// wanted either. One snapshot per user, covering their active property.
function storageKey(userId: string | null): string {
  return `${KEY_PREFIX}${userId ?? 'demo'}`;
}

export type EmergencySheetUtility = {
  id: string;
  name: string;
  utility_type: string;
  location_notes: string | null;
  emergency_notes: string | null;
};

export type EmergencySheetIssue = {
  id: string;
  title: string;
  issue_type: string;
  status: string;
  description: string | null;
};

export type EmergencySnapshot = {
  savedAt: string;
  propertyName: string | null;
  utilities: EmergencySheetUtility[];
  issues: EmergencySheetIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Persist the sheet after a successful load.
 *
 * Silent on every failure. Storage is unavailable in private mode, can be
 * disabled outright, and throws on quota — none of which is a reason to break
 * the page the user is currently looking at. A missing snapshot costs an
 * offline convenience; a thrown error costs the emergency page itself.
 *
 * An EMPTY result never overwrites a non-empty saved copy. This is the
 * important rule here, and it is not hypothetical: the data layer swallows
 * read failures and returns `[]` rather than throwing, and this app has a
 * documented history of a half-resolved session reading as signed-out so that
 * queries run as `anon` and come back empty instead of erroring (see
 * lib/supabase/guardedRead.ts). Without this guard, one degraded load silently
 * replaces a good emergency sheet with a blank one — destroying the offline
 * copy at exactly the moment it is most likely to be needed, and doing it
 * invisibly, because an empty sheet and "no shutoffs recorded" look identical.
 *
 * Losing a genuine deletion for one load is the cheaper mistake: the next
 * healthy load with any content still overwrites, and a user who really has
 * zero emergency items has nothing to show either way.
 */
export function saveEmergencySnapshot(
  userId: string | null,
  snapshot: Omit<EmergencySnapshot, 'savedAt'>
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const isEmpty = snapshot.utilities.length === 0 && snapshot.issues.length === 0;
    if (isEmpty) {
      const existing = readEmergencySnapshot(userId);
      if (existing && (existing.utilities.length > 0 || existing.issues.length > 0)) {
        return;
      }
    }

    const payload: EmergencySnapshot = { ...snapshot, savedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Intentionally ignored — see the doc comment above.
  }
}

/**
 * Read the sheet back when the live load could not complete.
 *
 * Validates defensively rather than trusting the parse: this is data written
 * by an older build of the app, and a shape change must degrade to "no saved
 * copy" instead of throwing inside a render on the emergency page.
 */
export function readEmergencySnapshot(userId: string | null): EmergencySnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.savedAt !== 'string') {
      return null;
    }

    const utilities = Array.isArray(parsed.utilities) ? parsed.utilities : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    return {
      savedAt: parsed.savedAt,
      propertyName: optionalString(parsed.propertyName),
      utilities: utilities.filter(isRecord).map((utility) => ({
        id: String(utility.id ?? ''),
        name: String(utility.name ?? 'Utility'),
        utility_type: String(utility.utility_type ?? 'other'),
        location_notes: optionalString(utility.location_notes),
        emergency_notes: optionalString(utility.emergency_notes)
      })),
      issues: issues.filter(isRecord).map((issue) => ({
        id: String(issue.id ?? ''),
        title: String(issue.title ?? 'Issue'),
        issue_type: String(issue.issue_type ?? 'other'),
        status: String(issue.status ?? 'open'),
        description: optionalString(issue.description)
      }))
    };
  } catch {
    return null;
  }
}

/**
 * Resolve `promise`, or give up after `ms` and return `fallback`.
 *
 * The emergency page must always reach a rendered state. Every other page can
 * afford to sit on a spinner while a request hangs; this one cannot, because
 * the situations it exists for — no signal, captive-portal wifi that accepts
 * connections and answers nothing, a phone that has just come back from
 * airplane mode — produce hangs rather than clean errors. A hung fetch has no
 * natural timeout in the browser, so an unbounded await here means a spinner
 * that never resolves at the exact moment someone needs a shutoff location.
 *
 * Timing out is always safe: the caller's failure path is the saved copy.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);

    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    );
  });
}

/** How the "you are looking at a saved copy" line reads. */
export function describeSnapshotAge(savedAt: string, now: Date = new Date()): string {
  const saved = new Date(savedAt);
  if (Number.isNaN(saved.getTime())) {
    return 'saved earlier';
  }

  const minutes = Math.floor((now.getTime() - saved.getTime()) / 60000);
  if (minutes < 1) {
    return 'saved just now';
  }
  if (minutes < 60) {
    return `saved ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `saved ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `saved ${days} day${days === 1 ? '' : 's'} ago`;
}
