// Record transfer — the ownership handoff primitive (migration 025, decision
// D-22). When a home sells, passes to an heir, or an inspector provisions a
// record for a buyer, the ENTIRE living record moves to the claimant: the
// property, its units, and everything documented inside them. Claiming clears
// every other seat and revokes outstanding invitations; the issuer keeps at
// most an explicitly chosen viewer/editor seat.
//
// The raw 64-hex-character code is returned by the create RPC exactly once and
// stored only as a SHA-256 hash — nothing here may persist it. All writes go
// through the migration-025 RPCs; the table itself is read-only to the client
// (RLS limits reads to the issuer and, after claiming, the claimant).

import { formatDataError } from './errors';
import { getSupabaseSetupMessage } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';

const TRANSFER_MIGRATION = 'supabase/migrations/025_record_transfer_partners.sql';

export type TransferKeepRole = 'editor' | 'viewer';

export type PropertyTransferRow = {
  id: string;
  property_id: string;
  issuer_user_id: string;
  partner_id: string | null;
  recipient_email: string | null;
  keep_issuer_role: TransferKeepRole | null;
  expires_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreatedPropertyTransfer = {
  transferId: string;
  /** The raw claim code. Shown once, never persisted client-side. */
  transferCode: string;
  expiresAt: string;
};

export type TransferPreview = {
  property_nickname: string;
  issuer_business_name: string | null;
  issuer_partner_kind: string | null;
  recipient_email: string | null;
  expires_at: string;
  already_claimed: boolean;
};

export type ClaimedTransfer = {
  propertyId: string;
  propertyNickname: string;
};

// --- Pure helpers (tested in tests/transfers.test.ts) ------------------------

export type TransferStatus = 'claimed' | 'revoked' | 'expired' | 'active';

const RAW_CODE_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Group a raw 64-hex claim code into dash-separated chunks of 8 so a human can
 * read it aloud or check it against a printout. Reversed by
 * compactTransferCode. Non-canonical input is passed through grouped as-is —
 * formatting never invents validity.
 */
export function formatTransferCode(code: string): string {
  const compact = code.replace(/[\s-]+/g, '');
  const chunks: string[] = [];
  for (let index = 0; index < compact.length; index += 8) {
    chunks.push(compact.slice(index, index + 8));
  }
  return chunks.join('-');
}

/**
 * Undo display formatting on a pasted claim code: strip whitespace and dashes,
 * lowercase, and validate the canonical 64-hex shape. Returns null when the
 * result is not a plausible code, so callers can reject typos before any RPC.
 */
export function compactTransferCode(input: string | null | undefined): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const compact = input.replace(/[\s-]+/g, '').toLowerCase();
  return RAW_CODE_PATTERN.test(compact) ? compact : null;
}

/**
 * The lifecycle state of a transfer row at a given instant. Claimed beats
 * revoked beats expired: a claimed transfer stays claimed no matter what else
 * is stamped on the row. Boundary matches the SQL (`expires_at < now()`): a
 * transfer is still active at the exact expiry instant.
 */
export function transferStatus(
  row: Pick<PropertyTransferRow, 'claimed_at' | 'revoked_at' | 'expires_at'>,
  nowIso: string
): TransferStatus {
  if (row.claimed_at) {
    return 'claimed';
  }
  if (row.revoked_at) {
    return 'revoked';
  }

  const expires = Date.parse(row.expires_at);
  const now = Date.parse(nowIso);
  if (Number.isFinite(expires) && Number.isFinite(now) && expires < now) {
    return 'expired';
  }

  return 'active';
}

// --- Error presentation ------------------------------------------------------

// The migration-025 RPCs raise deliberate, human-shaped errors. Those pass
// through as calm copy even in production; anything else (missing migration,
// RLS surprises, driver noise) goes through formatDataError, which hides the
// detail from customers and logs it for the operator. Order matters: more
// specific fragments first ("code is not valid" would otherwise swallow
// nothing, but keep the habit).
const FRIENDLY_TRANSFER_ERRORS: ReadonlyArray<readonly [fragment: string, friendly: string]> = [
  ['reserved for a different email', 'This transfer is reserved for a different email address. Sign in with the address it was issued to and try again.'],
  ['already been claimed', 'This transfer has already been claimed.'],
  ['has been revoked', 'This transfer was revoked by the person who issued it.'],
  ['code has expired', 'This transfer code has expired. Ask the issuer to create a new one.'],
  ['cannot claim your own', 'This code was issued from your own account — a record cannot be transferred to itself.'],
  ['no longer exists', 'The property behind this transfer no longer exists.'],
  ['no longer valid', 'This transfer is no longer valid — ownership changed after the code was issued.'],
  ['code is not valid', 'This code does not match an open transfer. Check it for typos, or ask the issuer whether it expired or was revoked.'],
  ['not signed in', 'Sign in first, then try again.'],
  ['only the owner can transfer', 'Only the property owner can transfer this record.'],
  ['units transfer with their building', 'Units move with their building. Open the building itself to transfer the whole record.'],
  ['keep role must be', 'The kept role must be viewer or editor.'],
  ['transfer not found', 'That transfer could not be found.'],
  ['property not found', 'That property could not be found.']
];

function presentTransferError(action: string, rawMessage: string | undefined): string {
  const detail = rawMessage || `Failed to ${action}.`;
  const lower = detail.toLowerCase();

  for (const [fragment, friendly] of FRIENDLY_TRANSFER_ERRORS) {
    if (lower.includes(fragment)) {
      return friendly;
    }
  }

  const needsMigration =
    lower.includes('could not find the function') ||
    lower.includes('schema cache') ||
    lower.includes('relation') ||
    lower.includes('column') ||
    lower.includes('constraint') ||
    lower.includes('violates row-level security') ||
    lower.includes('policy');

  return formatDataError(
    action,
    detail,
    needsMigration ? `Apply ${TRANSFER_MIGRATION} to your Supabase project, then try again.` : undefined
  );
}

// --- Data access -------------------------------------------------------------

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  return supabase;
}

const TRANSFER_SELECT =
  'id, property_id, issuer_user_id, partner_id, recipient_email, keep_issuer_role, expires_at, claimed_at, claimed_by, revoked_at, created_at, updated_at, deleted_at';

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeTransfer(raw: Partial<PropertyTransferRow>): PropertyTransferRow {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || '',
    property_id: raw.property_id || '',
    issuer_user_id: raw.issuer_user_id || '',
    partner_id: raw.partner_id || null,
    recipient_email: nullableString(raw.recipient_email),
    keep_issuer_role: raw.keep_issuer_role === 'editor' || raw.keep_issuer_role === 'viewer' ? raw.keep_issuer_role : null,
    expires_at: raw.expires_at || createdAt,
    claimed_at: raw.claimed_at || null,
    claimed_by: raw.claimed_by || null,
    revoked_at: raw.revoked_at || null,
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

/** Transfers for a property. RLS limits rows to ones the caller issued (or claimed). */
export async function listPropertyTransfers(propertyId: string): Promise<PropertyTransferRow[]> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('property_transfers')
    .select(TRANSFER_SELECT)
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(presentTransferError('load transfers', error.message));
  }

  return ((data ?? []) as Partial<PropertyTransferRow>[]).map(normalizeTransfer);
}

/**
 * Issue a transfer code for a property the caller owns. The returned code is
 * shown to the issuer exactly once; only its hash exists after this call.
 */
export async function createPropertyTransfer(input: {
  propertyId: string;
  recipientEmail?: string | null;
  keepIssuerRole?: TransferKeepRole | null;
  expiresInSeconds?: number;
}): Promise<CreatedPropertyTransfer> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('create_property_transfer', {
    target_property_id: input.propertyId,
    target_recipient_email: input.recipientEmail || null,
    target_keep_role: input.keepIssuerRole || null,
    target_expires_in_seconds: input.expiresInSeconds ?? 1209600
  });

  if (error) {
    throw new Error(presentTransferError('create the transfer', error.message));
  }

  const result = Array.isArray(data) ? data[0] : data;
  const transferId = String(result?.transfer_id || '');
  const transferCode = String(result?.transfer_code || '');
  const expiresAt = String(result?.expires_at || '');

  if (!transferId || !transferCode) {
    throw new Error(presentTransferError('create the transfer', 'The transfer was created without a code.'));
  }

  return { transferId, transferCode, expiresAt };
}

/** Revoke an unclaimed transfer the caller issued. */
export async function revokePropertyTransfer(transferId: string): Promise<void> {
  const supabase = requireSupabase();

  const { error } = await supabase.rpc('revoke_property_transfer', {
    target_transfer_id: transferId
  });

  if (error) {
    throw new Error(presentTransferError('revoke the transfer', error.message));
  }
}

/** What a claimant sees before accepting. Expects a compact (64-hex) code. */
export async function getTransferPreview(code: string): Promise<TransferPreview> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('get_property_transfer_preview', {
    transfer_code: code
  });

  if (error) {
    throw new Error(presentTransferError('look up the transfer', error.message));
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    throw new Error(presentTransferError('look up the transfer', 'this transfer code is not valid'));
  }

  return {
    property_nickname: String(result.property_nickname || 'This property'),
    issuer_business_name: nullableString(result.issuer_business_name),
    issuer_partner_kind: nullableString(result.issuer_partner_kind),
    recipient_email: nullableString(result.recipient_email),
    expires_at: String(result.expires_at || ''),
    already_claimed: Boolean(result.already_claimed)
  };
}

/**
 * Claim a transfer: the caller becomes owner of the property and its units,
 * every other seat is cleared, and outstanding invitations are revoked.
 * Expects a compact (64-hex) code.
 */
export async function claimTransfer(code: string): Promise<ClaimedTransfer> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('claim_property_transfer', {
    transfer_code: code
  });

  if (error) {
    throw new Error(presentTransferError('claim the transfer', error.message));
  }

  // The RPC's OUT columns carry a claimed_ prefix — a bare property_id OUT
  // parameter is ambiguous inside the function body (see migration 025).
  const result = Array.isArray(data) ? data[0] : data;
  const propertyId = String(result?.claimed_property_id || '');
  if (!propertyId) {
    throw new Error(presentTransferError('claim the transfer', 'The claim completed without returning the property.'));
  }

  return {
    propertyId,
    propertyNickname: String(result?.claimed_property_nickname || 'This property')
  };
}
