import { describe, expect, it } from 'vitest';
import {
  BUSINESS_NAME_MAX_LENGTH,
  PARTNER_KINDS,
  PRO_BINDER_PRODUCT_KEY,
  buildCheckoutUrl,
  validatePartnerInput
} from '../lib/partners';

// All pure functions: no supabase client, no network, no browser.

describe('validatePartnerInput', () => {
  it('accepts a plain registration and normalizes whitespace', () => {
    const result = validatePartnerInput({
      business_name: '  Hilltop Home Inspections  ',
      partner_kind: 'inspector'
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      business_name: 'Hilltop Home Inspections',
      partner_kind: 'inspector',
      website: null
    });
  });

  it('accepts every kind the database allows — and only those', () => {
    // Mirrors the CHECK constraint in migration 025 exactly.
    expect([...PARTNER_KINDS]).toEqual(['inspector', 'agent', 'property_manager', 'other']);

    for (const kind of PARTNER_KINDS) {
      expect(validatePartnerInput({ business_name: 'A', partner_kind: kind }).ok).toBe(true);
    }
  });

  it('rejects an empty or whitespace-only business name', () => {
    expect(validatePartnerInput({ business_name: '', partner_kind: 'agent' }).ok).toBe(false);
    expect(validatePartnerInput({ business_name: '   ', partner_kind: 'agent' }).ok).toBe(false);
  });

  it('accepts exactly the maximum-length name and rejects one past it', () => {
    const atLimit = 'a'.repeat(BUSINESS_NAME_MAX_LENGTH);
    const pastLimit = 'a'.repeat(BUSINESS_NAME_MAX_LENGTH + 1);

    expect(validatePartnerInput({ business_name: atLimit, partner_kind: 'other' }).ok).toBe(true);

    const rejected = validatePartnerInput({ business_name: pastLimit, partner_kind: 'other' });
    expect(rejected.ok).toBe(false);
    expect(rejected.value).toBeNull();
  });

  it('rejects an unknown kind', () => {
    const result = validatePartnerInput({ business_name: 'A', partner_kind: 'plumber' });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('treats a blank website as none at all', () => {
    for (const website of ['', '   ', null, undefined]) {
      const result = validatePartnerInput({
        business_name: 'A',
        partner_kind: 'inspector',
        website
      });
      expect(result.ok).toBe(true);
      expect(result.value?.website).toBeNull();
    }
  });

  it('rejects a website that is not an http(s) URL', () => {
    for (const website of ['not a url', 'javascript:alert(1)', 'ftp://example.com']) {
      const result = validatePartnerInput({
        business_name: 'A',
        partner_kind: 'inspector',
        website
      });
      expect(result.ok).toBe(false);
      expect(result.value).toBeNull();
    }
  });

  it('keeps a valid https website', () => {
    const result = validatePartnerInput({
      business_name: 'A',
      partner_kind: 'inspector',
      website: 'https://example.com/inspections'
    });
    expect(result.ok).toBe(true);
    expect(result.value?.website).toBe('https://example.com/inspections');
  });

  it('collects every problem in one pass rather than stopping at the first', () => {
    const result = validatePartnerInput({
      business_name: '',
      partner_kind: 'nope',
      website: 'not a url'
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});

describe('buildCheckoutUrl (shared by getProBinderCheckoutUrl)', () => {
  it('returns null when the payment link is unset — the soft-gate stays inert', () => {
    expect(buildCheckoutUrl(undefined, 'user-1')).toBeNull();
    expect(buildCheckoutUrl(null, 'user-1')).toBeNull();
    expect(buildCheckoutUrl('', 'user-1')).toBeNull();
  });

  it('refuses a non-https link — a Payment Link is always https', () => {
    expect(buildCheckoutUrl('http://buy.stripe.com/abc', 'user-1')).toBeNull();
    expect(buildCheckoutUrl('javascript:alert(1)', 'user-1')).toBeNull();
  });

  it('returns the bare link when there is no user to reference', () => {
    expect(buildCheckoutUrl('https://buy.stripe.com/abc', null)).toBe('https://buy.stripe.com/abc');
  });

  it('appends client_reference_id with the right separator', () => {
    expect(buildCheckoutUrl('https://buy.stripe.com/abc', 'user-1')).toBe(
      'https://buy.stripe.com/abc?client_reference_id=user-1'
    );
    expect(buildCheckoutUrl('https://buy.stripe.com/abc?locale=en', 'user-1')).toBe(
      'https://buy.stripe.com/abc?locale=en&client_reference_id=user-1'
    );
  });

  it('URL-encodes the user id', () => {
    expect(buildCheckoutUrl('https://buy.stripe.com/abc', 'a b/c')).toBe(
      'https://buy.stripe.com/abc?client_reference_id=a%20b%2Fc'
    );
  });
});

describe('pro binder product key', () => {
  it('matches the key the Stripe webhook grants on', () => {
    expect(PRO_BINDER_PRODUCT_KEY).toBe('pro_binder');
  });
});
