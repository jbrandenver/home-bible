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

// The fee ladder, in three rungs (docs/PRICING_AND_PLANS.md, ruled 2026-07-31
// and reaffirmed 2026-08-06):
//
//   home 1        free, forever
//   homes 2 and 3 $4.99/mo each, one additional_home subscription per home
//   home 4+       the Portfolio plan
//
// The cap is the part that is easy to miss. Without it, per-home subscriptions
// stack without limit and undercut the plan they are supposed to lead to: five
// of them is $24.95/mo for six homes, against $29 for unlimited. So the number
// of additional_home subscriptions that can count is capped at two, in the
// database as well as here.
//
// This value is mirrored by public.free_property_allowance(); the database one
// decides what is actually permitted, this one only decides what the UI offers.
// Change them in the same deploy, and ship this side FIRST — a UI that offers
// the paid step while the database is still lenient costs nothing, whereas the
// reverse blocks a customer with an explanation the page has not caught up to.
//
// Existing homes are never re-checked (035 is INSERT-only), so tightening this
// never takes a home away from someone who already has it.
export const FREE_PROPERTY_ALLOWANCE = 1;

/** How many $4.99 homes can be stacked before the Portfolio plan is required. */
export const MAX_PER_HOME_ADDITIONS = 2;

/** The most homes reachable without the Portfolio plan: the free one plus the paid two. */
export const MAX_HOMES_WITHOUT_PORTFOLIO = FREE_PROPERTY_ALLOWANCE + MAX_PER_HOME_ADDITIONS;

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
 * The emailed no-code portal link — now the FALLBACK, not the main route.
 *
 * It authenticates by email, which is exactly its weakness: it only works when
 * the address someone paid with matches the one they log in with. When it does
 * not, Stripe truthfully reports "no payments on file" about a different
 * customer record and the customer concludes their subscription is missing.
 * openBillingPortal() below resolves the real customer instead; this stays as
 * the safety net for anyone whose purchase predates provider_customer_id (045)
 * and for the case where the session call fails outright.
 *
 * No fallback URL on purpose. Guessing wrong here would send a paying customer
 * somewhere that cannot cancel their plan.
 */
export function getBillingPortalUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL;
  return base && /^https:\/\//i.test(base) ? base : null;
}

/**
 * Open this customer's billing directly, with no email step.
 *
 * The billing-portal function resolves which Stripe customer to open from the
 * caller's own entitlement rows, keyed on the user id in their verified JWT —
 * nothing about whose billing to open crosses the wire, so a caller cannot ask
 * for someone else's.
 *
 * Returns the URL to send the browser to, or null when there is nothing to
 * open. Never throws: the caller falls back to the emailed link, and a
 * customer who wants to cancel must never hit a dead end.
 */
export async function createBillingPortalSession(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('billing-portal', { method: 'POST' });
    if (error || !data || typeof (data as { url?: unknown }).url !== 'string') {
      return null;
    }

    const url = (data as { url: string }).url;
    // Only ever follow Stripe's own host — this value decides a navigation.
    return /^https:\/\/[a-z0-9-]+\.stripe\.com\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** Which rung adding one more home lands on: nothing to buy, the $4.99 step, or the plan. */
export type PortfolioUpgradePath = 'none' | 'per_home' | 'portfolio';

export type PortfolioAccess = {
  /** What to offer for the NEXT home. See the fee ladder above. */
  upgradePath: PortfolioUpgradePath;
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

  // Which rung of the ladder adding one more home lands on. Offering Portfolio
  // to someone adding their second home would be quoting $29 for something
  // that costs $4.99 — the middle rung has to be named explicitly, or the UI
  // silently skips it.
  const upgradePath: PortfolioUpgradePath = input.hasPlan
    ? 'none'
    : withinFreeAllowance
      ? 'none'
      : input.propertyCount < MAX_HOMES_WITHOUT_PORTFOLIO
        ? 'per_home'
        : 'portfolio';

  return {
    hasPlan: input.hasPlan,
    paymentsConfigured: input.paymentsConfigured,
    propertyCount: input.propertyCount,
    withinFreeAllowance,
    upgradePath,
    requiresUpgradeToAdd: input.paymentsConfigured && !input.hasPlan && !withinFreeAllowance
  };
}
