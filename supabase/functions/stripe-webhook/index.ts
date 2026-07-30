// Stripe webhook → entitlements.
//
// This endpoint is public: Stripe cannot present a user JWT, so `verify_jwt`
// is false for this function in config.toml. The signature check below is
// therefore the ONLY thing between the internet and the entitlements table.
// Nothing touches the database before verification succeeds.
//
// Three Deno-specific details that are easy to get wrong:
//   1. constructEventAsync, not constructEvent — Deno has no synchronous node
//      crypto, so verification goes through Web Crypto and returns a promise.
//   2. Stripe.createSubtleCryptoProvider() must be passed as the 5th argument.
//      Omitting it is the most common cause of "signature verification failed".
//   3. await req.text(), never req.json() — the HMAC covers the raw bytes, and
//      any reserialisation invalidates it.
//
// SAFE BEFORE STRIPE EXISTS: with no STRIPE_WEBHOOK_SIGNING_SECRET configured
// the function refuses every request rather than half-working.

import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRODUCT_KEYS = new Set(['handover_pack', 'insurance_evidence_pack']);

// Recurring plans. A subscription entitlement carries provider_subscription_id
// and a rolling expires_at: stamped at checkout, extended by every paid
// invoice, cut off by subscription deletion. has_entitlement() already honours
// expires_at, so a missed cancellation webhook fails SAFE — access lapses at
// the end of the last paid period plus grace, rather than living forever.
const SUBSCRIPTION_PRODUCT_KEYS = new Set(['portfolio_plan']);

// Grace beyond the paid period, covering invoice-retry windows and webhook
// delivery lag so a paying customer never sees a flicker of lost access.
const SUBSCRIPTION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function subscriptionExpiry(periodEndSeconds: number | null | undefined): string {
  const base =
    typeof periodEndSeconds === 'number' && Number.isFinite(periodEndSeconds)
      ? periodEndSeconds * 1000
      : // No period on the object (rare) — 35 days covers monthly billing
        // until the first invoice.paid arrives to set the real horizon.
        Date.now() + 35 * 24 * 60 * 60 * 1000;
  return new Date(base + SUBSCRIPTION_GRACE_MS).toISOString();
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeKey || !signingSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('stripe-webhook: not configured');
    return json({ error: 'Not configured.' }, 503);
  }

  const signature = request.headers.get('Stripe-Signature');
  if (!signature) {
    return json({ error: 'Missing signature.' }, 400);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      signingSecret,
      undefined,
      cryptoProvider
    );
  } catch (verifyError) {
    console.error('stripe-webhook: signature verification failed', {
      message: verifyError instanceof Error ? verifyError.message : 'unknown'
    });
    return json({ error: 'Invalid signature.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const objectId = (event.data.object as { id?: string })?.id ?? null;

  // Idempotency in the database, not in application logic: two concurrent
  // retries would both pass a select-then-insert check. The unique constraint
  // arbitrates instead.
  const { error: logError } = await supabase.from('payment_events').insert({
    id: event.id,
    provider: 'stripe',
    type: event.type,
    object_id: objectId,
    payload: event as unknown as Record<string, unknown>
  });

  if (logError) {
    if (logError.code === '23505') {
      // Already handled. Acknowledge so Stripe stops retrying.
      return json({ ok: true, duplicate: true });
    }
    console.error('stripe-webhook: could not record event', { code: logError.code });
    // 500 so Stripe retries — never claim success we have not committed.
    return json({ error: 'Storage error.' }, 500);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // A session can complete unpaid with delayed-notification methods.
      if (session.payment_status !== 'paid') {
        return json({ ok: true, ignored: 'not paid' });
      }

      const productKey = (session.metadata?.product_key ?? '').trim();
      const reference = (session.client_reference_id ?? '').trim();

      // client_reference_id arrives from a URL parameter the buyer controls,
      // and Stripe silently drops malformed values. So it may be absent,
      // wrong, or someone else's — never trust it as authorisation, only as a
      // hint about who to credit.
      let userId: string | null = null;
      if (/^[0-9a-f-]{36}$/i.test(reference)) {
        const { data: user } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', reference)
          .maybeSingle();
        userId = user?.id ?? null;
      }

      // Fall back to the email Stripe collected before giving up.
      if (!userId && session.customer_details?.email) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', session.customer_details.email.toLowerCase())
          .maybeSingle();
        userId = byEmail?.id ?? null;
      }

      const isSubscription = SUBSCRIPTION_PRODUCT_KEYS.has(productKey);

      if (!userId || (!PRODUCT_KEYS.has(productKey) && !isSubscription)) {
        // Money taken, nobody to credit. This must land somewhere visible
        // rather than vanishing into the logs.
        await supabase.from('unmatched_purchases').insert({
          provider_checkout_id: session.id,
          customer_email: session.customer_details?.email ?? null,
          product_key: productKey || null,
          amount_total_cents: session.amount_total ?? null,
          currency: session.currency ?? null,
          raw_reference: reference || null
        });
        console.error('stripe-webhook: unmatched purchase', { session: session.id });
        return json({ ok: true, unmatched: true });
      }

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : null;

      // For a subscription checkout, anchor expires_at to the subscription's
      // real billing period rather than guessing from today.
      let expiresAt: string | null = null;
      if (isSubscription) {
        let periodEnd: number | null = null;
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            periodEnd = subscription.current_period_end ?? null;
          } catch (retrieveError) {
            console.error('stripe-webhook: could not retrieve subscription', {
              message: retrieveError instanceof Error ? retrieveError.message : 'unknown'
            });
          }
        }
        expiresAt = subscriptionExpiry(periodEnd);
      }

      const { error: grantError } = await supabase.from('entitlements').insert({
        user_id: userId,
        product_key: productKey,
        provider: 'stripe',
        provider_checkout_id: session.id,
        provider_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        provider_subscription_id: subscriptionId,
        amount_total_cents: session.amount_total ?? null,
        currency: session.currency ?? null,
        expires_at: expiresAt,
        status: 'active'
      });

      // A duplicate here means the grant already exists — fine.
      if (grantError && grantError.code !== '23505') {
        console.error('stripe-webhook: grant failed', { code: grantError.code });
        return json({ error: 'Could not grant entitlement.' }, 500);
      }

      return json({ ok: true, granted: productKey });
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : null;

      if (subscriptionId) {
        // Roll the horizon forward to the end of the period this invoice paid
        // for. Update-if-exists on purpose: an invoice for a subscription we
        // never granted (or already refunded) is not an invitation to grant.
        const periodEnd = invoice.lines?.data?.[0]?.period?.end ?? null;
        await supabase
          .from('entitlements')
          .update({ expires_at: subscriptionExpiry(periodEnd) })
          .eq('provider_subscription_id', subscriptionId)
          .eq('status', 'active');
      }

      return json({ ok: true, renewed: Boolean(subscriptionId) });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;

      // Same bookkeeping stance as refunds: never hard-delete, the row is the
      // audit trail. Access ends now rather than at period end because Stripe
      // only emits this event once the subscription is truly over.
      await supabase
        .from('entitlements')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('provider_subscription_id', subscription.id)
        .eq('status', 'active');

      return json({ ok: true, revoked: true });
    }

    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const charge = event.data.object as Stripe.Charge | Stripe.Dispute;
      const paymentIntent =
        typeof (charge as Stripe.Charge).payment_intent === 'string'
          ? ((charge as Stripe.Charge).payment_intent as string)
          : typeof (charge as Stripe.Dispute).payment_intent === 'string'
            ? ((charge as Stripe.Dispute).payment_intent as string)
            : null;

      if (paymentIntent) {
        // Bookkeeping rather than clawback: a downloaded PDF cannot be recalled.
        // It stops regeneration and keeps the books honest. Never hard-delete —
        // the row is dispute evidence.
        await supabase
          .from('entitlements')
          .update({ status: 'refunded', revoked_at: new Date().toISOString() })
          .eq('provider_payment_intent_id', paymentIntent);
      }

      return json({ ok: true, revoked: true });
    }

    return json({ ok: true, ignored: event.type });
  } catch (handlerError) {
    console.error('stripe-webhook: handler failed', {
      message: handlerError instanceof Error ? handlerError.message : 'unknown'
    });
    return json({ error: 'Handler failed.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
