import { safeHttpUrl } from '@home-folder/shared';
import { formatDataError } from './errors';
import { getCurrentUser } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

// The professional channel (docs/THREAT_MITIGATION.md, T6 / Phase 5).
//
// A partner row is a label, not a role (migration 025): registering grants no
// access to anything. Its whole job is co-branding — create_property_transfer
// auto-attaches the issuer's partner_id, so a buyer claiming a pre-seeded
// record sees "Prepared by {business_name}" with no extra plumbing here.

const PARTNERS_MIGRATION = 'supabase/migrations/025_record_transfer_partners.sql';

export const PARTNER_KINDS = ['inspector', 'agent', 'property_manager', 'other'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  inspector: 'Home inspector',
  agent: 'Real-estate agent',
  property_manager: 'Property manager',
  other: 'Other professional'
};

export type PartnerRow = {
  id: string;
  user_id: string;
  business_name: string;
  partner_kind: PartnerKind;
  website: string | null;
  created_at: string;
  updated_at: string;
};

export const BUSINESS_NAME_MAX_LENGTH = 200;

export type PartnerInput = {
  business_name: string;
  partner_kind: string;
  website?: string | null;
};

export type PartnerValidation = {
  ok: boolean;
  errors: string[];
  value: { business_name: string; partner_kind: PartnerKind; website: string | null } | null;
};

// Pure, so tests cover the rules without a browser or a database. Mirrors the
// database constraints in migration 025 exactly — a value that passes here
// must not bounce off a CHECK constraint later.
export function validatePartnerInput(input: PartnerInput): PartnerValidation {
  const errors: string[] = [];

  const businessName = (input.business_name ?? '').trim();
  if (businessName.length === 0) {
    errors.push('Enter the business name as it should appear on the handover.');
  } else if (businessName.length > BUSINESS_NAME_MAX_LENGTH) {
    errors.push(`Keep the business name under ${BUSINESS_NAME_MAX_LENGTH} characters.`);
  }

  const kind = (input.partner_kind ?? '').trim();
  const isKnownKind = (PARTNER_KINDS as readonly string[]).includes(kind);
  if (!isKnownKind) {
    errors.push('Choose the kind of work you do from the list.');
  }

  const websiteRaw = (input.website ?? '').trim();
  let website: string | null = null;
  if (websiteRaw.length > 0) {
    website = safeHttpUrl(websiteRaw);
    if (!website) {
      errors.push('Use a full website address starting with http:// or https://, or leave it blank.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, value: null };
  }

  return {
    ok: true,
    errors: [],
    value: { business_name: businessName, partner_kind: kind as PartnerKind, website }
  };
}

function formatPartnerError(action: string, message?: string) {
  const detail = message || `Failed to ${action}.`;
  const lowerMessage = detail.toLowerCase();
  const needsMigration =
    lowerMessage.includes('relation') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('constraint') ||
    lowerMessage.includes('violates row-level security') ||
    lowerMessage.includes('policy') ||
    lowerMessage.includes('invalid input value');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${PARTNERS_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

const PARTNER_SELECT = 'id, user_id, business_name, partner_kind, website, created_at, updated_at';

export async function getMyPartnerProfile(): Promise<PartnerRow | null> {
  const supabase = getSupabaseBrowserClient();
  const user = await getCurrentUser();
  if (!supabase || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from('partners')
    .select(PARTNER_SELECT)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(formatPartnerError('load your partner profile', error.message));
  }

  return (data as PartnerRow | null) ?? null;
}

export async function upsertPartnerProfile(input: PartnerInput): Promise<PartnerRow> {
  const supabase = getSupabaseBrowserClient();
  const user = await getCurrentUser();
  if (!supabase || !user) {
    throw new Error('Sign in to register a partner profile.');
  }

  const validation = validatePartnerInput(input);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join(' '));
  }

  // user_id is unique (migration 025), so "insert or update own row" is a
  // plain upsert keyed on it. RLS keeps both paths scoped to auth.uid().
  const { data, error } = await supabase
    .from('partners')
    .upsert(
      {
        user_id: user.id,
        business_name: validation.value.business_name,
        partner_kind: validation.value.partner_kind,
        website: validation.value.website
      },
      { onConflict: 'user_id' }
    )
    .select(PARTNER_SELECT)
    .single();

  if (error || !data) {
    throw new Error(formatPartnerError('save your partner profile', error?.message));
  }

  return data as PartnerRow;
}

// --- Per-binder billing ------------------------------------------------------

// One-time Stripe product for the pro channel: one purchase per binder handed
// to a client. Same webhook, same entitlements table as the packs.
export const PRO_BINDER_PRODUCT_KEY = 'pro_binder';

// Pure piece of the checkout URL logic, shared with tests: same https guard
// and client_reference_id append as getPortfolioCheckoutUrl in entitlements.ts.
export function buildCheckoutUrl(base: string | null | undefined, userId: string | null): string | null {
  if (!base || !/^https:\/\//i.test(base)) {
    return null;
  }
  if (!userId) {
    return base;
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}client_reference_id=${encodeURIComponent(userId)}`;
}

// The Stripe Payment Link for a single pro binder, configured per
// docs/ACTIVATION_RUNBOOK.md §B. Absent until Jesse creates it — and
// everything here stays inert (the pro page says so honestly).
export function getProBinderCheckoutUrl(userId: string | null): string | null {
  return buildCheckoutUrl(process.env.NEXT_PUBLIC_STRIPE_PRO_BINDER_PAYMENT_LINK, userId);
}
