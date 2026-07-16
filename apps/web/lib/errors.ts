// Centralized error presentation.
//
// Goal: customers see a calm, non-technical message; the real technical detail
// (RLS violations, missing-migration hints, raw Supabase errors) is written to
// the console / host logs for the operator — and is automatically picked up by
// an error tracker (e.g. Sentry) if one is added later. In development the full
// detail is still shown in the UI to speed up debugging.

const isProduction = process.env.NODE_ENV === 'production';

/** Log a technical detail for the operator (browser console + host logs). */
export function operatorLog(context: string, detail: unknown): void {
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error(`[our-home-folder] ${context}`, detail);
  }
}

/**
 * Build the message a USER should see for a failed data action.
 * @param action  short verb phrase, e.g. "load documents" / "save device"
 * @param detail  the raw technical error message
 * @param devHint optional developer-only hint (migration path, RLS note)
 */
export function formatDataError(action: string, detail: string, devHint?: string): string {
  operatorLog(`Failed to ${action}`, devHint ? `${detail} — ${devHint}` : detail);

  if (!isProduction) {
    return devHint
      ? `Failed to ${action}. ${devHint} Original error: ${detail}`
      : `Failed to ${action}. ${detail}`;
  }

  // Production: never surface migration paths, RLS internals, or raw driver text.
  return `Sorry — we couldn’t ${action} just now. Please try again in a moment.`;
}
