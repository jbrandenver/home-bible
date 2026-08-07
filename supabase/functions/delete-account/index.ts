import { createClient } from 'npm:@supabase/supabase-js@2.112.0';

// Account deletion is irreversible, so the caller must have signed in recently
// rather than merely holding a long-lived refreshed session.
const REAUTH_WINDOW_MS = 30 * 60 * 1000;

// Browsers preflight this call because supabase-js sends Authorization and
// x-client-info. Origins are pinned — never '*' — so no other site can invoke
// account deletion with a user's ambient credentials.
const ALLOWED_ORIGINS = [
  Deno.env.get('SITE_URL'),
  'https://ourhomefolder.com',
  'https://www.ourhomefolder.com',
  'http://localhost:3000',
  'http://localhost:3055'
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

  // Preflight only — deliberately performs no work and touches no data.
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
    return json({ error: 'Delete-account function is not configured.' }, 500, cors);
  }

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Sign in again before deleting your account.' }, 401, cors);
  }

  const user = userData.user;
  const userId = user.id;

  // Require a recent sign-in. A token lifted from an unattended or shared
  // device should not be enough to erase someone's home record.
  const lastSignInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
  if (!Number.isFinite(lastSignInAt) || Date.now() - lastSignInAt > REAUTH_WINDOW_MS) {
    return json(
      {
        error:
          'For your security, sign out and sign back in, then delete your account within 30 minutes.',
        code: 'reauthentication_required'
      },
      401,
      cors
    );
  }

  // Closing can wait for the end of the period the customer already paid for.
  // 'scheduled' is what the current app sends for a subscriber; 'immediate'
  // is the explicit "I want it gone now" choice, and is also what an older
  // client that sends no body at all gets, which is the behaviour it expects.
  let mode: 'scheduled' | 'immediate' = 'immediate';
  try {
    const body = await request.json();
    if (body && body.mode === 'scheduled') {
      mode = 'scheduled';
    }
  } catch {
    // No body, or not JSON. Immediate is the safe reading: it is what every
    // caller before this change meant.
  }

  // ---------------------------------------------------------------------
  // Billing comes down BEFORE any data does.
  //
  // Deleting the account used to leave the Stripe subscription running: the
  // card kept being charged every month for a login that no longer existed,
  // and the customer's only remaining move was a chargeback. Neither this
  // function nor delete_account_data touched Stripe or entitlements at all.
  //
  // Order is deliberate and is the whole safety property. Cancelling first
  // means the failure mode is "account still exists, still billing" — visible,
  // recoverable, and the customer can try again. Deleting first would make the
  // failure mode "account gone, still billing", which is exactly the bug and
  // is unrecoverable from the customer's side.
  //
  // Fail closed: any subscription we cannot prove is cancelled aborts the
  // deletion entirely.
  // ---------------------------------------------------------------------
  const { data: liveSubs, error: subsError } = await serviceClient
    .from('entitlements')
    .select('id, product_key, provider_subscription_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('provider_subscription_id', 'is', null);

  if (subsError) {
    console.error('delete-account: could not read entitlements', {
      code: subsError.code,
      message: subsError.message
    });
    return json(
      { error: 'Could not check your billing before deleting. Please try again.' },
      500,
      cors
    );
  }

  const subscriptions = liveSubs ?? [];

  // ---------------------------------------------------------------------
  // Scheduled close: keep the time they bought.
  //
  // Stripe is told to stop at the period end rather than now, and the closure
  // is recorded for process_due_account_closures() to action on the day. The
  // account stays fully usable until then — it was paid for — and the customer
  // can still change their mind. Nothing is erased in this branch.
  //
  // Only meaningful for a subscriber: with no subscription there is no period
  // to wait for, so those fall through to the immediate path below.
  // ---------------------------------------------------------------------
  if (mode === 'scheduled' && subscriptions.length > 0) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('delete-account: STRIPE_SECRET_KEY missing, cannot schedule');
      return json(
        { error: 'Could not schedule your closure. Please try again or contact support.' },
        503,
        cors
      );
    }

    let latestPeriodEnd: number | null = null;

    for (const entitlement of subscriptions) {
      const subscriptionId = String(entitlement.provider_subscription_id);
      const scheduled = await scheduleSubscriptionCancel(subscriptionId, stripeKey);

      if (!scheduled.ok) {
        console.error('delete-account: could not schedule cancel', {
          subscription: subscriptionId,
          status: scheduled.status,
          message: scheduled.message
        });
        return json(
          {
            error:
              'Could not schedule your closure, so nothing has changed. Please try again or contact support.'
          },
          502,
          cors
        );
      }

      // Several subscriptions: close after the last one runs out, so no paid
      // period is ever cut short.
      if (scheduled.periodEnd && (!latestPeriodEnd || scheduled.periodEnd > latestPeriodEnd)) {
        latestPeriodEnd = scheduled.periodEnd;
      }
    }

    // Stripe should always give a period end; if it somehow did not, fall back
    // to a month out rather than scheduling a deletion for right now.
    const scheduledFor = latestPeriodEnd
      ? new Date(latestPeriodEnd * 1000).toISOString()
      : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

    const { error: closureError } = await serviceClient
      .from('account_closures')
      .upsert(
        {
          user_id: userId,
          scheduled_for: scheduledFor,
          requested_at: new Date().toISOString(),
          provider_subscription_id: String(subscriptions[0].provider_subscription_id)
        },
        { onConflict: 'user_id' }
      )
      .select('user_id');

    if (closureError) {
      console.error('delete-account: could not record closure', {
        code: closureError.code,
        message: closureError.message
      });
      return json(
        { error: 'Could not schedule your closure. Please try again or contact support.' },
        500,
        cors
      );
    }

    await serviceClient.rpc('log_audit_event', {
      p_event_type: 'account.closure_scheduled',
      p_payload: { user_id: userId, scheduled_for: scheduledFor },
      p_severity: 'alert',
      p_actor: userId
    });

    return json({ ok: true, scheduled: true, scheduled_for: scheduledFor }, 200, cors);
  }

  if (subscriptions.length > 0) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      // An unconfigured key is not a reason to proceed — proceeding is what
      // silently keeps charging someone.
      console.error('delete-account: STRIPE_SECRET_KEY missing with live subscriptions', {
        count: subscriptions.length
      });
      return json(
        {
          error:
            'Your plan could not be cancelled, so your account was left untouched. Please contact support.'
        },
        503,
        cors
      );
    }

    for (const entitlement of subscriptions) {
      const subscriptionId = String(entitlement.provider_subscription_id);
      const cancelled = await cancelSubscription(subscriptionId, stripeKey);

      if (!cancelled.ok) {
        console.error('delete-account: subscription cancel failed', {
          subscription: subscriptionId,
          status: cancelled.status,
          message: cancelled.message
        });
        return json(
          {
            error:
              'Your plan could not be cancelled, so your account was left untouched and you have not been charged anything new. Please try again or contact support.'
          },
          502,
          cors
        );
      }

      // Revoke locally too. If the customer.subscription.deleted webhook is
      // slow or lost, the entitlement would otherwise outlive the account.
      const { error: revokeError } = await serviceClient
        .from('entitlements')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', entitlement.id)
        .select('id');

      if (revokeError) {
        // Stripe has already stopped charging, which is the part that costs
        // money, so this does not abort. Logged loudly because the row is now
        // out of step with Stripe until the webhook lands.
        console.error('delete-account: entitlement revoke failed after Stripe cancel', {
          entitlement: entitlement.id,
          message: revokeError.message
        });
      }
    }

    await serviceClient.rpc('log_audit_event', {
      p_event_type: 'billing.cancelled_on_account_deletion',
      p_payload: {
        user_id: userId,
        subscriptions: subscriptions.map((s) => s.provider_subscription_id),
        product_keys: subscriptions.map((s) => s.product_key)
      },
      p_severity: 'alert',
      p_actor: userId
    });
  }

  // One transaction: properties are transferred or closed, memberships are
  // released, and the profile is anonymised — all of it, or none of it.
  const { data: summary, error: dataError } = await serviceClient.rpc('delete_account_data', {
    target_user_id: userId
  });

  if (dataError) {
    console.error('delete-account: data erasure failed', {
      code: dataError.code,
      message: dataError.message
    });
    return json({ error: 'Could not delete your account. Please try again.' }, 500, cors);
  }

  // Record the deletion before the login goes, and keep the user id in the
  // payload as well as the actor column: audit_events.actor_user_id is
  // ON DELETE SET NULL, so after deleteUser the column would be null and the
  // trail would no longer say who this was. Support needs that id to answer
  // "did my account actually get deleted, and when".
  await serviceClient.rpc('log_audit_event', {
    p_event_type: 'account.deleted',
    p_payload: { user_id: userId, ...(summary ?? {}) },
    p_severity: 'alert',
    p_actor: userId
  });

  // Only now is it safe to remove the login — everything it pointed at is gone.
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: auth deleteUser failed', {
      status: deleteError.status,
      message: deleteError.message
    });
    return json(
      {
        error:
          'Your home data was removed, but the login could not be deleted. Please contact support so we can finish.'
      },
      500,
      cors
    );
  }

  return json({ ok: true, ...(summary ?? {}) }, 200, cors);
});

/**
 * Cancel one subscription immediately, via the REST API rather than the SDK —
 * this function has no other reason to pull Stripe in.
 *
 * Immediate, not at period end: the account is about to stop existing, so
 * leaving a subscription running until the renewal date would bill for access
 * nobody can use. The confirm dialog says this in as many words before the
 * customer commits, including that the rest of the period is not refunded.
 *
 * A subscription Stripe no longer has, or has already cancelled, counts as
 * success — the goal is "this is not going to charge anyone again", and both
 * of those satisfy it. Anything else is a failure and aborts the deletion.
 */
async function cancelSubscription(
  subscriptionId: string,
  stripeKey: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  let response: Response;
  try {
    response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Version': '2024-06-20'
      }
    });
  } catch (error) {
    // Network failure: we cannot claim the subscription is cancelled.
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'network error' };
  }

  if (response.ok) {
    return { ok: true };
  }

  let payload: { error?: { code?: string; message?: string } } = {};
  try {
    payload = await response.json();
  } catch {
    // Body was not JSON; the status alone decides below.
  }

  // Already gone from Stripe's side.
  if (response.status === 404 || payload.error?.code === 'resource_missing') {
    return { ok: true };
  }

  return {
    ok: false,
    status: response.status,
    message: payload.error?.message ?? `HTTP ${response.status}`
  };
}

/**
 * Tell Stripe to stop this subscription at the end of the paid period rather
 * than now, and report when that period ends.
 *
 * Matches how the customer portal is configured to cancel (`at_period_end`),
 * so both routes out of a plan behave the same way. Reversible on purpose:
 * cancel-account-closure sets the same flag back to false.
 */
async function scheduleSubscriptionCancel(
  subscriptionId: string,
  stripeKey: string
): Promise<
  { ok: true; periodEnd: number | null } | { ok: false; status: number; message: string }
> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2024-06-20'
        },
        body: new URLSearchParams({ cancel_at_period_end: 'true' })
      }
    );
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'network error'
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
    error?: { message?: string };
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload.error?.message ?? `HTTP ${response.status}`
    };
  }

  // Newer API versions carry the period on the subscription item rather than
  // the subscription, so read both before giving up.
  const periodEnd =
    payload.current_period_end ?? payload.items?.data?.[0]?.current_period_end ?? null;

  return { ok: true, periodEnd };
}

function json(body: Record<string, unknown>, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors
    }
  });
}
