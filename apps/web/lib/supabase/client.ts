import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

const REQUEST_TIMEOUT_MS = 20_000;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      // Without a deadline a stalled request never settles, so `loading` stays
      // true forever and the page's primary action sits disabled with no
      // explanation. Failing after 20s at least produces an error the UI can
      // show and the user can retry.
      fetch: (input, init) => {
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const signal = init?.signal
          ? // Caller already passed a signal (e.g. an unmounting component);
            // honour whichever aborts first.
            AbortSignal.any([init.signal, timeout])
          : timeout;

        return fetch(input, { ...init, signal });
      }
    }
  });

  return browserClient;
}
