import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

// Opens the caller's own Stripe billing portal.
//
// Why this exists rather than the no-code portal link: that link authenticates
// by email, so it only works when the address someone pays with matches the
// one they log in with. When it does not — a work card, a spouse's account, a
// personal address on a business subscription — Stripe correctly reports "no
// payments on file" about a DIFFERENT customer record, and the customer
// concludes their subscription has vanished. That happened for real here: the
// founder account has two live Stripe customers and the subscription sits on
// the one he did not try.
//
// The security property that matters: the customer id is resolved from the
// caller's own entitlement rows, keyed on the user id inside their verified
// JWT. It is never read from the request body. A caller cannot ask for someone
// else's billing because there is nowhere to say whose billing to open.

const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL'),
  'https://ourhomefolder.com',
  'https://www.ourhomefolder.com',
  'http://localhost:3000',
  'http://localhost:3055',
  'http://localhost:3056'
].filter((value): value is string => Boolean(value));

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeKey) {
    console.error('billing-portal: not configured');
    return json({ error: 'Billing is not configured.' }, 503, cors);
  }

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in to manage your billing.' }, 401, cors);
  }

  const userId = userData.user.id;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // Whose billing: taken from this user's rows, never from the request.
  // Ordered newest-first so an account that has repurchased lands on the
  // customer record its current plan actually lives on.
  const { data: rows, error: lookupError } = await serviceClient
    .from('entitlements')
    .select('provider_customer_id, status, created_at')
    .eq('user_id', userId)
    .not('provider_customer_id', 'is', null)
    .order('created_at', { ascending: false });

  if (lookupError) {
    console.error('billing-portal: entitlement lookup failed', {
      code: lookupError.code,
      message: lookupError.message
    });
    return json({ error: 'Could not open your billing. Please try again.' }, 500, cors);
  }

  const candidates = rows ?? [];
  // Prefer a live plan; fall back to any past purchase so someone whose
  // subscription has lapsed can still reach invoices and receipts.
  const customerId =
    candidates.find((row) => row.status === 'active')?.provider_customer_id ??
    candidates[0]?.provider_customer_id ??
    null;

  if (!customerId) {
    // Nothing was ever bought under this account, or it predates 045 and was
    // not backfilled. Either way the client falls back to the emailed portal
    // link rather than dead-ending.
    return json({ error: 'No billing found for this account.', code: 'no_customer' }, 404, cors);
  }

  const returnUrl = `${(Deno.env.get('SITE_URL') || 'https://ourhomefolder.com').replace(/\/$/, '')}/settings`;

  const body = new URLSearchParams({
    customer: String(customerId),
    return_url: returnUrl
  });

  let response: Response;
  try {
    response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20'
      },
      body
    });
  } catch (error) {
    console.error('billing-portal: Stripe unreachable', {
      message: error instanceof Error ? error.message : 'unknown'
    });
    return json({ error: 'Could not reach Stripe. Please try again.' }, 502, cors);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: { message?: string; code?: string };
  };

  if (!response.ok || !payload.url) {
    // The most likely cause in practice is the portal not being configured in
    // the Stripe dashboard, which is a setup step, not a customer's problem.
    console.error('billing-portal: session create failed', {
      status: response.status,
      code: payload.error?.code,
      message: payload.error?.message
    });
    return json({ error: 'Could not open your billing. Please try again.' }, 502, cors);
  }

  // The URL is single-use and short-lived; it is the response, never logged.
  return json({ url: payload.url }, 200, cors);
});

function json(body: Record<string, unknown>, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}
