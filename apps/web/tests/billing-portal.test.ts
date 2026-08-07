import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBillingPortalSession, getBillingPortalUrl } from '../lib/entitlements';
import * as supabaseClient from '../lib/supabase/client';

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

// The session route replaces the email step: the edge function resolves which
// Stripe customer to open from the caller's own entitlement rows, so the
// address someone paid with no longer has to match the one they log in with.
// The returned URL decides a navigation, so it is checked before it is used.
describe('billing portal session', () => {
  function mockInvoke(result: unknown) {
    vi.spyOn(supabaseClient, 'getSupabaseBrowserClient').mockReturnValue({
      functions: { invoke: () => Promise.resolve(result) }
    } as unknown as ReturnType<typeof supabaseClient.getSupabaseBrowserClient>);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the session url the function issued', async () => {
    mockInvoke({ data: { url: 'https://billing.stripe.com/p/session/live_xyz' }, error: null });
    await expect(createBillingPortalSession()).resolves.toBe(
      'https://billing.stripe.com/p/session/live_xyz'
    );
  });

  it('refuses a redirect anywhere but Stripe', async () => {
    // A tampered or wrong response must not become an open redirect just
    // because it arrived from our own function.
    for (const url of [
      'https://evil.example/p/session/x',
      'http://billing.stripe.com/p/session/x',
      'javascript:alert(1)',
      'https://stripe.com.evil.example/x'
    ]) {
      mockInvoke({ data: { url }, error: null });
      await expect(createBillingPortalSession()).resolves.toBeNull();
    }
  });

  it('returns null when the function errors or has no customer', async () => {
    // Null is what routes the caller to the emailed-link fallback rather than
    // dead-ending someone who is trying to cancel.
    mockInvoke({ data: null, error: { message: 'no_customer' } });
    await expect(createBillingPortalSession()).resolves.toBeNull();

    mockInvoke({ data: {}, error: null });
    await expect(createBillingPortalSession()).resolves.toBeNull();
  });

  it('returns null rather than throwing when Supabase is unconfigured', async () => {
    vi.spyOn(supabaseClient, 'getSupabaseBrowserClient').mockReturnValue(null);
    await expect(createBillingPortalSession()).resolves.toBeNull();
  });
});
