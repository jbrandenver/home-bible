import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

// Undo a scheduled account closure.
//
// A closure that cannot be called off is a trap: the whole point of scheduling
// it for the end of the paid period is that the customer keeps using the
// account in the meantime, and people change their minds. This puts both
// halves back — the pending deletion and the Stripe cancellation — so the
// account carries on as if nothing had been asked for.
//
// Deliberately NOT part of delete-account: a function named for deletion that
// also un-deletes is a foot-gun for whoever reads it next.
//
// Whose closure is never a parameter. It is the user id inside the caller's
// verified JWT, so this cannot be pointed at somebody else's account.

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

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Not configured.' }, 503, cors);
  }

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in again to keep your account.' }, 401, cors);
  }

  const userId = userData.user.id;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: closure, error: readError } = await serviceClient
    .from('account_closures')
    .select('user_id, provider_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.error('cancel-account-closure: lookup failed', {
      code: readError.code,
      message: readError.message
    });
    return json({ error: 'Could not keep your account. Please try again.' }, 500, cors);
  }

  if (!closure) {
    // Nothing pending. Idempotent rather than an error — the desired state is
    // already true, and a double-click must not read as a failure.
    return json({ ok: true, restored: false }, 200, cors);
  }

  // The pending deletion goes first. If the Stripe call below fails, the worst
  // case is an account that survives with a subscription still set to lapse —
  // recoverable, and visible to the customer in the portal. The reverse order
  // could leave a live subscription attached to an account still queued for
  // deletion, which bills for something about to disappear.
  const { error: clearError } = await serviceClient
    .from('account_closures')
    .delete()
    .eq('user_id', userId)
    .select('user_id');

  if (clearError) {
    console.error('cancel-account-closure: could not clear closure', {
      code: clearError.code,
      message: clearError.message
    });
    return json({ error: 'Could not keep your account. Please try again.' }, 500, cors);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const subscriptionId = closure.provider_subscription_id;
  let subscriptionRestored = false;

  if (stripeKey && subscriptionId) {
    try {
      const response = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(String(subscriptionId))}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2024-06-20'
          },
          body: new URLSearchParams({ cancel_at_period_end: 'false' })
        }
      );
      subscriptionRestored = response.ok;
      if (!response.ok) {
        console.error('cancel-account-closure: could not un-cancel subscription', {
          subscription: subscriptionId,
          status: response.status
        });
      }
    } catch (error) {
      console.error('cancel-account-closure: Stripe unreachable', {
        message: error instanceof Error ? error.message : 'unknown'
      });
    }
  }

  await serviceClient.rpc('log_audit_event', {
    p_event_type: 'account.closure_cancelled',
    p_payload: { user_id: userId, subscription_restored: subscriptionRestored },
    p_severity: 'notice',
    p_actor: userId
  });

  // The account is safe either way; the flag only says whether the plan is
  // also back, so the UI can tell the customer to check their billing if not.
  return json({ ok: true, restored: true, subscription_restored: subscriptionRestored }, 200, cors);
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
