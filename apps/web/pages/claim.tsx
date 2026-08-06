import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, ConfirmDialog, PageHeader } from '@home-folder/ui';
import { getCurrentUser, isSupabaseConfigured } from '../lib/auth';
import { setActivePropertyId } from '../lib/properties';
import {
  claimTransfer,
  compactTransferCode,
  getTransferPreview,
  type ClaimedTransfer,
  type TransferPreview
} from '../lib/transfers';

// The claimant's side of a record transfer (migration 025). Modeled on
// accept-invite.tsx, with one deliberate difference: accept-invite auto-runs
// its token from the URL, but claiming MOVES OWNERSHIP, so nothing here is
// automatic. A ?code= query param is supported for convenience (mirroring
// accept-invite's token links) — it only prefills the form; the preview and
// the claim itself always wait for the person to act.

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const subtleText = { color: 'var(--text-muted)' };

function formatExpiry(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type AuthState = 'checking' | 'unconfigured' | 'signed_out' | 'signed_in';

export default function ClaimPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [codeInput, setCodeInput] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [claimed, setClaimed] = useState<ClaimedTransfer | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [confirmingClaim, setConfirmingClaim] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setAuthState('unconfigured');
        return;
      }

      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setAuthState(user ? 'signed_in' : 'signed_out');
        }
      } catch {
        // Timeout checking the session: treat as signed out so the person can
        // sign in explicitly rather than hitting an RPC that will reject them.
        if (isMounted) setAuthState('signed_out');
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Convenience only: a ?code= link prefills the field. It never previews or
  // claims on its own.
  useEffect(() => {
    if (!router.isReady) return;
    const queryCode = typeof router.query.code === 'string' ? router.query.code : '';
    if (queryCode) {
      setCodeInput((current) => current || queryCode);
    }
  }, [router.isReady, router.query.code]);

  const lookUpTransfer = async (event: FormEvent) => {
    event.preventDefault();
    if (previewLoading || claiming) return;

    setError('');
    setPreview(null);
    setVerifiedCode('');

    const compact = compactTransferCode(codeInput);
    if (!compact) {
      setError('That does not look like a transfer code. It is 64 letters and numbers — paste the whole thing, dashes and spaces are fine.');
      return;
    }

    setPreviewLoading(true);
    try {
      const nextPreview = await getTransferPreview(compact);
      setPreview(nextPreview);
      setVerifiedCode(compact);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Failed to look up the transfer.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // In-page confirmation rather than window.confirm, which a browser may
  // suppress — it then returns false and the claim silently does nothing.
  const requestClaim = () => {
    if (!preview || !verifiedCode || claiming) return;
    setError('');
    setConfirmingClaim(true);
  };

  const claimRecord = async () => {
    if (!preview || !verifiedCode || claiming) return;

    setClaiming(true);
    setError('');

    try {
      const result = await claimTransfer(verifiedCode);
      setActivePropertyId(result.propertyId);
      setConfirmingClaim(false);
      setClaimed(result);
      setPreview(null);
      setVerifiedCode('');
    } catch (claimError) {
      // Close the dialog so the error is readable on the page.
      setConfirmingClaim(false);
      setError(claimError instanceof Error ? claimError.message : 'Failed to claim the transfer.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Claim a Record"
        description="A home's living record — every serial number, paint code, repair, and manual — transfers to its new owner intact."
      />

      {authState === 'checking' ? (
        <Card>
          <p style={{ margin: 0, ...subtleText }}>Checking your sign-in...</p>
        </Card>
      ) : null}

      {authState === 'unconfigured' ? (
        <Card>
          <p style={{ margin: 0 }}>
            Record transfers need an account to move the record to, and this deployment is not connected to a database yet.
          </p>
        </Card>
      ) : null}

      {authState === 'signed_out' ? (
        <Card>
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>
              You have been handed the record of a home. Sign in — or create a free account — first, so the record has
              somewhere to go. Then come back to this page and enter your transfer code.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link href={`/sign-in?next=${encodeURIComponent(router.asPath)}`}>Sign in</Link>
              <Link href={`/sign-up?next=${encodeURIComponent(router.asPath)}`}>Create an account</Link>
            </div>
          </div>
        </Card>
      ) : null}

      {authState === 'signed_in' && !claimed ? (
        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Enter your transfer code</h2>
            <p style={subtleText}>
              The current owner — or the professional who prepared the record — gave you a claim code. Paste it below to
              see what is waiting for you before anything changes hands.
            </p>
            <form onSubmit={lookUpTransfer} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Transfer code</span>
                <input
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx-..."
                  autoComplete="off"
                  spellCheck={false}
                  style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
                />
              </label>
              <div>
                <Button type="submit" disabled={previewLoading}>
                  {previewLoading ? 'Looking up...' : 'Look up this transfer'}
                </Button>
              </div>
              {error ? <p style={{ margin: 0, color: 'var(--status-urgent)' }}>{error}</p> : null}
            </form>
          </Card>

          {preview ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>{preview.property_nickname}</h2>
              {preview.issuer_business_name ? (
                <p style={{ marginTop: 0, fontWeight: 600 }}>
                  Prepared for you by {preview.issuer_business_name}
                  {preview.issuer_partner_kind ? ` (${formatEnumLabel(preview.issuer_partner_kind)})` : ''}
                </p>
              ) : null}
              <p style={subtleText}>
                Claiming makes you the owner of this record — the property, any units, and everything documented inside.
                Access the previous owner shared with anyone else is removed at the same moment.
              </p>
              <p style={subtleText}>Claim by {formatExpiry(preview.expires_at)}.</p>
              {preview.recipient_email ? (
                <p style={subtleText}>
                  This transfer is reserved for {preview.recipient_email}. You must be signed in with that email address
                  to claim it.
                </p>
              ) : null}
              {preview.already_claimed ? (
                <p style={{ margin: 0 }}>This transfer has already been claimed.</p>
              ) : (
                <div>
                  <Button type="button" onClick={requestClaim} disabled={claiming}>
                    {claiming ? 'Claiming...' : 'Claim this record'}
                  </Button>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {claimed ? (
        <Card>
          <div style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0 }}>{claimed.propertyNickname}</h2>
            <p style={{ margin: 0 }}>
              This record is now yours. Every room, appliance, repair, and document carries on exactly where the previous
              owner left it.
            </p>
            <div>
              <Button type="button" onClick={() => router.push('/dashboard')}>Go to dashboard</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmingClaim}
        title={preview ? `Claim ${preview.property_nickname}?` : 'Claim this record?'}
        description="You will become the owner of this entire record — the property, any units, and everything documented inside. Any access the previous owner had shared with others will be removed."
        confirmLabel="Claim record"
        cancelLabel="Cancel"
        destructive={false}
        busy={claiming}
        onConfirm={claimRecord}
        onCancel={() => {
          if (!claiming) {
            setConfirmingClaim(false);
          }
        }}
      />
    </>
  );
}
