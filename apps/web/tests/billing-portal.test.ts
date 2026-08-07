import { afterEach, describe, expect, it } from 'vitest';
import { getBillingPortalUrl } from '../lib/entitlements';

const ORIGINAL = process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL;
  } else {
    process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL = ORIGINAL;
  }
});

// /pricing promises "Cancel: Any time" on both subscription entries, so the
// portal link is the thing that keeps that promise. It has no fallback value
// on purpose — sending a paying customer to a guessed URL that cannot cancel
// their plan is worse than showing them the support-email path instead. These
// tests pin the "absent or unusable config renders nothing" half of that.
describe('billing portal url', () => {
  it('returns null when unconfigured, so the UI falls back to support', () => {
    delete process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL;
    expect(getBillingPortalUrl()).toBeNull();

    process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL = '';
    expect(getBillingPortalUrl()).toBeNull();
  });

  it('refuses anything that is not https', () => {
    // A billing destination is exactly the kind of link worth being strict
    // about: http is downgradeable and javascript: would be an XSS sink.
    for (const value of [
      'http://billing.stripe.com/p/login/abc',
      'javascript:alert(1)',
      'billing.stripe.com/p/login/abc',
      '/billing'
    ]) {
      process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL = value;
      expect(getBillingPortalUrl()).toBeNull();
    }
  });

  it('passes a configured https portal link through unchanged', () => {
    // No client_reference_id appended, unlike the checkout links — the portal
    // authenticates by email itself and takes no caller-supplied identity.
    const url = 'https://billing.stripe.com/p/login/test_abc123';
    process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL = url;
    expect(getBillingPortalUrl()).toBe(url);
  });
});
