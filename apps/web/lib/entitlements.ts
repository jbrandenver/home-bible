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

// A homeowner's normal life fits in the free tier: the home plus one more
// place (a rental, the cabin, a parent's house). The Portfolio plan starts
// where a portfolio starts — at the third door or the first building.
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
