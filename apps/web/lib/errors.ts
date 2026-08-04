// Centralized error presentation.
//
// Goal: customers see a calm, non-technical message that says what actually
// happened and what to do about it; the real technical detail (RLS violations,
// constraint names, raw driver text) goes to the console and host logs for the
// operator, and is picked up by an error tracker if one is added later.
//
// Two bars a message has to clear:
//   1. Never name a database object. "new row violates row-level security
//      policy for table utilities" is not a sentence anybody outside this repo
//      can act on.
//   2. Never give advice that cannot work. The old production fallback said
//      "Please try again in a moment" for every failure — including a viewer
//      who lacks permission, who can retry forever and never succeed.

const isProduction = process.env.NODE_ENV === 'production';

/** Log a technical detail for the operator (browser console + host logs). */
export function operatorLog(context: string, detail: unknown): void {
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error(`[our-home-folder] ${context}`, detail);
  }
}

/**
 * Sentences this application raises on purpose, in words already chosen for a
 * person — the home allowance, invitation refusals, scan limits, transfer
 * guards. These are the ONLY messages passed through untouched.
 *
 * An allowlist rather than a blocklist, deliberately. Screening out text that
 * looks like database output lets anything unfamiliar through by default, and
 * "unfamiliar" is exactly what a new driver error, a new Postgres version, or
 * a third-party library will produce. Defaulting to the calm fallback costs a
 * little specificity; defaulting the other way costs a customer another
 * sentence like "new row violates row-level security policy".
 */
const APP_AUTHORED_PATTERNS: RegExp[] = [
  /invitation/i,
  /\bhomes?\b.*\b(portfolio|subscription|plan)\b/i,
  /portfolio plan/i,
  /data-plate scans?/i,
  /scan (safety )?ceiling/i,
  /retention window/i,
  /can no longer grant access/i,
  /only owners and co-owners/i,
  /create a property/i,
  /transfer/i
];

function isAppAuthored(message: string): boolean {
  return APP_AUTHORED_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Turn whatever the database said into something a person can act on.
 *
 * `action` is a short verb phrase — "add a utility", "save this repair" — and
 * is woven into the sentence so it reads as a statement about their task
 * rather than about our schema.
 */
export function describeDataError(action: string, rawMessage?: string): string {
  const detail = (rawMessage || '').trim();
  const lower = detail.toLowerCase();

  // Permission. The case founder QA hit: a viewer adding a utility. Retrying
  // is useless, so this must not suggest it — it must say who can fix it.
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('insufficient privilege')
  ) {
    return `You don’t have permission to ${action} in this home. If it was shared with you, you probably have view-only access — ask whoever shared it to give you editing access.`;
  }

  if (lower.includes('duplicate key') || lower.includes('already exists')) {
    return `That already exists in this home, so we didn’t ${action} again. Open the existing one to change it.`;
  }

  if (lower.includes('foreign key')) {
    return `We couldn’t ${action} because something it links to is no longer there — it may have been deleted. Refresh the page and try again.`;
  }

  if (lower.includes('null value in column') || lower.includes('not-null')) {
    return `We couldn’t ${action} because a required detail is missing. Fill in every field marked required, then save again.`;
  }

  if (
    lower.includes('check constraint') ||
    lower.includes('invalid input') ||
    lower.includes('syntax error')
  ) {
    return `We couldn’t ${action} because one of the details isn’t in a form we recognise. Check any dates, numbers and dropdowns, then save again.`;
  }

  if (lower.includes('jwt') || lower.includes('refresh token') || lower.includes('not authenticated')) {
    return `Your session ended, so we couldn’t ${action}. Sign in again — your work should still be here.`;
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return `We couldn’t reach your home record to ${action}. Check your connection and try again.`;
  }

  // A guard trigger refusing an edit is a permission problem wearing a column
  // name. Say what it means.
  if (lower.includes('cannot be changed') || lower.includes('immutable')) {
    return `That detail can’t be changed once it’s set. If it’s wrong, remove this record and add it again.`;
  }

  // Only our own deliberately-written sentences pass through. Postgres
  // convention lowercases the first word of a raised message; a customer is
  // reading a sentence, so capitalise it.
  if (detail && isAppAuthored(detail)) {
    return detail.charAt(0).toUpperCase() + detail.slice(1);
  }

  return `Sorry — we couldn’t ${action} just now. Please try again in a moment.`;
}

/**
 * Build the message a USER should see for a failed data action.
 * @param action  short verb phrase, e.g. "load documents" / "save device"
 * @param detail  the raw technical error message
 * @param devHint optional developer-only hint (migration path, RLS note)
 */
export function formatDataError(action: string, detail: string, devHint?: string): string {
  operatorLog(`Failed to ${action}`, devHint ? `${detail} — ${devHint}` : detail);

  const customerMessage = describeDataError(action, detail);

  if (!isProduction) {
    // Developers see exactly what a customer would see, plus the truth behind
    // it — so a bad translation is obvious while building rather than after
    // shipping. The old behaviour showed only the raw text, which is why the
    // customer-facing wording was never reviewed.
    return devHint
      ? `${customerMessage}\n\n[dev] ${devHint} Original: ${detail}`
      : `${customerMessage}\n\n[dev] Original: ${detail}`;
  }

  return customerMessage;
}
