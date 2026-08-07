import { PORTFOLIO_PRODUCT_KEY } from '@home-folder/shared';
import { getSupabaseBrowserClient } from './supabase/client';

// Client-side reads of the entitlements table (via the has_entitlement RPC —
// SECURITY DEFINER, identity from auth.uid(), see migration 022). This is a
// UI convenience, not the enforcement boundary: the table itself has no
// insert/update/delete policy, so nothing here can grant anything.

export async function hasEntitlement(productKey: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc('has_entitlement', { p_product_key: productKey });
  if (error) {
    // Fail closed for paid features; the caller decides how to message it.
    return false;
  }

  return Boolean(data);
}

export function hasPortfolioPlan(): Promise<boolean> {
  return hasEntitlement(PORTFOLIO_PRODUCT_KEY);
}

// Every product key that can produce a paid artifact. A user may hold more
// than one; the recorder logs against whichever it finds, because any of them
// is proof the purchase was delivered.
const RECORDABLE_PRODUCT_KEYS = [PORTFOLIO_PRODUCT_KEY, 'pro_binder', 'additional_home'] as const;

/**
 * Log that a paid artifact was actually produced for this user.
 *
 * This is the evidence Stripe asks for when a digital-goods purchase is
 * disputed, and it is the one thing here that cannot be reconstructed later —
 * the day a chargeback arrives is the day it is too late to start collecting.
 *
 * Deliberately fire-and-forget and deliberately silent: the caller has already
 * produced the customer's document by the time this runs, and no logging
 * failure may ever stand between a paying customer and the thing they bought.
 * The RPC resolves the entitlement from auth.uid() itself (migration 038), so
 * a caller cannot log against a purchase it does not hold, and returns false
 * rather than erroring when the user holds nothing — free users produce no
 * rows, which is correct.
 */
export function recordEntitlementDownload(context: string): void {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  for (const productKey of RECORDABLE_PRODUCT_KEYS) {
    void supabase
      .rpc('record_entitlement_download', { p_product_key: productKey, p_context: context })
      .then(() => undefined, () => undefined);
  }
}

// DELIBERATE LAG — this value does not state the current pricing rule.
//
// The 2026-07-31 ruling (docs/PRICING_AND_PLANS.md) is that Free is ONE home;
// homes 2-3 are $4.99/mo each and Portfolio starts at the fourth door or the
// first building. /pricing already says exactly that. This stays at 2 so that
// nobody is blocked from a second home while the fee ladder is only half
// switched on — the lag errs in the customer's favour.
//
// As of 2026-08-06 the plumbing this lag was waiting on EXISTS:
//   * the $4.99 link is live (NEXT_PUBLIC_STRIPE_PER_HOME_PAYMENT_LINK),
//   * stripe-webhook treats 'additional_home' as a subscription product, and
//   * property_allowance_for() already computes
//     free_property_allowance() + count(active 'additional_home').
//
// So closing the lag is now a one-line change in two places rather than a
// build. It is left open on purpose because it is a revenue decision, not a
// cleanup, and because no 'additional_home' entitlement has ever been written
// (the payment link's product_key metadata is unverified — that exact gotcha
// bit us before). Verify a real $4.99 checkout produces an entitlement row
// FIRST; a link whose metadata is missing takes the money and grants nothing.
//
// When flipping it: change this to 1 AND public.free_property_allowance() to
// 1 in the same deploy. The database value is what permits or refuses the
// insert (035); this one only decides when the UI offers an upgrade. Existing
// owners keep every home they already have — 035's check is INSERT-only and
// deliberately never re-tests existing rows.
export const FREE_PROPERTY_ALLOWANCE = 2;

// Stripe Payment Links, configured the same way as the one-time products in
// docs/ACTIVATION_RUNBOOK.md. Absent until Jesse activates the Stripe
// account — and everything here stays inert.
function buildPaymentLinkUrl(base: string | undefined, userId: string | null): string | null {
  if (!base || !/^https:\/\//i.test(base)) {
    return null;
  }
  if (!userId) {
    return base;
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}client_reference_id=${encodeURIComponent(userId)}`;
}

/** The recurring Portfolio plan ($29/mo, unlimited homes). */
export function getPortfolioCheckoutUrl(userId: string | null): string | null {
  return buildPaymentLinkUrl(process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK, userId);
}

/** The per-additional-home subscription ($4.99/mo, homes two and three). */
export function getPerHomeCheckoutUrl(userId: string | null): string | null {
  return buildPaymentLinkUrl(process.env.NEXT_PUBLIC_STRIPE_PER_HOME_PAYMENT_LINK, userId);
}

/**
 * Stripe's hosted customer portal, where a subscriber changes their card,
 * downloads invoices, or cancels.
 *
 * /pricing promises "Cancel: Any time" in two places, so a customer must have
 * somewhere to go and do it. This is the no-code portal login link: the
 * customer enters the email they paid with and Stripe sends them a one-time
 * link. That deliberately avoids storing a Stripe customer id against the
 * account and avoids an edge function to mint portal sessions — there is no
 * per-user secret involved and nothing here can be forged into someone else's
 * billing, because Stripe authenticates the email itself.
 *
 * No fallback URL on purpose. Unlike the payment links, guessing wrong here
 * would send a paying customer somewhere that cannot cancel their plan; absent
 * config renders no button at all, and the UI says to email support instead.
 */
export function getBillingPortalUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL;
  return base && /^https:\/\//i.test(base) ? base : null;
}

export type PortfolioAccess = {
  hasPlan: boolean;
  paymentsConfigured: boolean;
  propertyCount: number;
  withinFreeAllowance: boolean;
  // True when adding another property should be blocked behind the plan.
  // Only ever true once payments are actually configured: before that,
  // blocking would gate users behind a checkout that does not exist.
  requiresUpgradeToAdd: boolean;
};

// Pure so tests can cover the gate matrix without a browser or a database.
export function evaluatePortfolioAccess(input: {
  hasPlan: boolean;
  paymentsConfigured: boolean;
  propertyCount: number;
}): PortfolioAccess {
  const withinFreeAllowance = input.propertyCount < FREE_PROPERTY_ALLOWANCE;
  return {
    hasPlan: input.hasPlan,
    paymentsConfigured: input.paymentsConfigured,
    propertyCount: input.propertyCount,
    withinFreeAllowance,
    requiresUpgradeToAdd: input.paymentsConfigured && !input.hasPlan && !withinFreeAllowance
  };
}
