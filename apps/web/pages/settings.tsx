import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { PageHeader, Card, Button, Input, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import {
  getCurrentUser,
  isSupabaseConfigured,
  onAuthStateChange,
  signOut
} from '../lib/auth';
import {
  formatAddressLine,
  getPrimaryPropertyForUser,
  getPropertyAddressDetails,
  updatePropertyAddress,
  type PropertySummary
} from '../lib/properties';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import {
  buildAccountExport,
  buildCsvSheets,
  buildReadme,
  downloadTextFile
} from '../lib/accountExport';
import { getAssetDataContext } from '../lib/assets';
import { getAutomationContext } from '../lib/automation';
import { getDocumentDataContext } from '../lib/documents';
import { getIssueDataContext } from '../lib/issues';
import { getReceiptDataContext } from '../lib/receipts';
import { getReminderDataContext } from '../lib/reminders';
import { getRepairDataContext } from '../lib/repairs';
import { getServiceRecordDataContext } from '../lib/serviceRecords';
import { getTrendFlagDataContext } from '../lib/trendFlags';
import { getUtilityDataContext } from '../lib/utilities';

export default function SettingsPage() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');

  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPostal, setAddressPostal] = useState('');
  const [addressEnabled, setAddressEnabled] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressSaved, setAddressSaved] = useState(false);
  const [addressLoadFailed, setAddressLoadFailed] = useState(false);
  const [addressDirty, setAddressDirty] = useState(false);

  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportNote, setExportNote] = useState('');

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((currentUser) => {
      if (!isMounted) {
        return;
      }

      setUser(currentUser);
      setIsReady(true);
    });

    const unsubscribe = onAuthStateChange((nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAddress() {
      if (!user) {
        setProperty(null);
        return;
      }

      setAddressLoading(true);
      setAddressError('');
      setAddressLoadFailed(false);

      try {
        const nextProperty = await getPrimaryPropertyForUser(user.id);
        const details = nextProperty ? await getPropertyAddressDetails(nextProperty.id) : null;

        if (!isMounted) {
          return;
        }

        setProperty(nextProperty);
        setAddressLine1(details?.address_line_1 || '');
        setAddressLine2(details?.address_line_2 || '');
        setAddressCity(details?.city || '');
        setAddressState(details?.state || '');
        setAddressPostal(details?.postal_code || '');
        setAddressEnabled(details?.address_is_enabled || false);
        setAddressDirty(false);
      } catch (loadError) {
        if (isMounted) {
          setAddressLoadFailed(true);
          setAddressError(loadError instanceof Error ? loadError.message : 'Failed to load the property address.');
        }
      } finally {
        if (isMounted) {
          setAddressLoading(false);
        }
      }
    }

    loadAddress();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Any edit invalidates the previous confirmation, so the user can't be shown
  // "Address saved." while looking at unsaved changes.
  function noteAddressEdited() {
    setAddressSaved(false);
    setAddressDirty(true);
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) {
      return;
    }

    setAddressSaving(true);
    setAddressError('');
    setAddressSaved(false);

    try {
      await updatePropertyAddress(property.id, {
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        city: addressCity,
        state: addressState,
        postal_code: addressPostal,
        address_is_enabled: addressEnabled
      });
      setAddressSaved(true);
      setAddressDirty(false);
    } catch (saveError) {
      setAddressError(saveError instanceof Error ? saveError.message : 'Failed to save the property address.');
    } finally {
      setAddressSaving(false);
    }
  }

  // Typing a correction and navigating away used to lose it silently.
  useEffect(() => {
    if (!addressDirty) {
      return;
    }

    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnOnUnload);
    return () => window.removeEventListener('beforeunload', warnOnUnload);
  }, [addressDirty]);

  async function handleExport(format: 'json' | 'csv') {
    setExporting(format);
    setExportError('');
    setExportNote('');

    try {
      const [utility, asset, reminder, repair, serviceRecord, issue, trendFlag, documentCtx, receipt, automation] =
        await Promise.all([
          getUtilityDataContext(),
          getAssetDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext(),
          getDocumentDataContext(),
          getReceiptDataContext(),
          getAutomationContext()
        ]);

      const data = await buildAccountExport(property, {
        utility,
        asset,
        reminder,
        repair,
        serviceRecord,
        issue,
        trendFlag,
        document: documentCtx,
        receipt,
        automation
      });

      const stamp = data.generatedAt.slice(0, 10);

      if (format === 'json') {
        downloadTextFile(
          `home-folder-export-${stamp}.json`,
          JSON.stringify(data, null, 2),
          'application/json'
        );
        downloadTextFile(`home-folder-export-${stamp}-README.txt`, buildReadme(data));
        setExportNote('Downloaded your full record, plus a README explaining what is in it.');
      } else {
        const sheets = buildCsvSheets(data);
        if (sheets.length === 0) {
          setExportNote('There is nothing recorded to export yet.');
          return;
        }

        for (const sheetFile of sheets) {
          downloadTextFile(
            `home-folder-${sheetFile.name}-${stamp}.csv`,
            sheetFile.contents,
            'text/csv'
          );
        }
        downloadTextFile(`home-folder-export-${stamp}-README.txt`, buildReadme(data));
        setExportNote(
          `Downloaded ${sheets.length} spreadsheet${sheets.length === 1 ? '' : 's'}, plus a README.`
        );
      }
    } catch (error) {
      setExportError(
        error instanceof Error
          ? `Could not build your export: ${error.message}`
          : 'Could not build your export. Please try again.'
      );
    } finally {
      setExporting(null);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Delete your account? This anonymizes your profile, removes memberships, and transfers or soft-deletes homes you own. This cannot be undone.')) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAccountError('Supabase is not configured.');
      return;
    }

    setDeletingAccount(true);
    setAccountError('');

    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST'
    });

    setDeletingAccount(false);

    if (error) {
      // functions.invoke reports a generic "non-2xx status" message; the useful
      // text (for example the re-authentication prompt) is in the response body.
      let message = 'Failed to delete account.';
      const context: unknown = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        try {
          const body = await context.json();
          if (body && typeof body.error === 'string') {
            message = body.error;
          }
        } catch {
          /* body was not JSON — fall back to the generic message */
        }
      } else if (error.message) {
        message = error.message;
      }

      setAccountError(message);
      return;
    }

    await signOut();
    setUser(null);
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Privacy, account, and safe testing controls for Our Home Folder."
      />

      <div style={{ display: 'grid', gap: 24 }}>
          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>Our Home Folder</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)', marginBottom: 0 }}>
              A home, documented. Keep the record calm, private, and complete enough to hand on.
            </p>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Account</h2>
            {!supabaseReady ? (
              <p style={{ color: 'var(--status-attention)', margin: 0 }}>
                Account saving is not available in this local build. Demo data stays only in this browser.
              </p>
            ) : !isReady ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading account...</p>
            ) : user ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <UtilityBadge label={`Signed in as ${user.email || 'account'}`} />
                <div>
                  <Button type="button" onClick={handleSignOut} variant="secondary">
                    Sign out
                  </Button>
                </div>
                <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                  <strong>Delete account</strong>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Deletes the auth account, anonymizes the profile, removes memberships, and transfers or soft-deletes owned homes.
                  </p>
                  {accountError ? <p style={{ color: 'var(--status-urgent)', margin: 0 }}>{accountError}</p> : null}
                  <div>
                    <Button
                      type="button"
                      disabled={deletingAccount}
                      onClick={handleDeleteAccount}
                      style={{ background: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}
                    >
                      {deletingAccount ? 'Deleting...' : 'Delete account'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Demo data is stored only in this browser.</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <ActionLink href="/sign-in">Sign in</ActionLink>
                  <ActionLink href="/sign-up" variant="secondary">Create account</ActionLink>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Property address</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Optional. When enabled, the address appears on service call sheets and handover
              reports so a technician knows where to go — it is never shown anywhere else.
            </p>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to save your property address.
              </p>
            ) : addressLoadFailed ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">
                  We could not load your property address.
                </p>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  {addressError} Nothing has been changed — this is a loading problem, not a
                  missing property, so please retry rather than creating a new one.
                </p>
                <div>
                  <Button type="button" variant="secondary" onClick={() => setUser((current) => (current ? { ...current } : current))}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : !property && !addressLoading ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create a property first — the address belongs to it.</p>
                <div>
                  <ActionLink href="/create-property" variant="secondary">Create property</ActionLink>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveAddress} style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <label>
                    <span>Street address</span>
                    <Input
                      value={addressLine1}
                      onChange={(event) => { setAddressLine1(event.target.value); noteAddressEdited(); }}
                      placeholder="123 Main St"
                      autoComplete="address-line1"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>Apt, unit, etc. (optional)</span>
                    <Input
                      value={addressLine2}
                      onChange={(event) => { setAddressLine2(event.target.value); noteAddressEdited(); }}
                      placeholder="Unit B"
                      autoComplete="address-line2"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <label>
                    <span>City</span>
                    <Input
                      value={addressCity}
                      onChange={(event) => { setAddressCity(event.target.value); noteAddressEdited(); }}
                      autoComplete="address-level2"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>State</span>
                    <Input
                      value={addressState}
                      onChange={(event) => { setAddressState(event.target.value); noteAddressEdited(); }}
                      autoComplete="address-level1"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>ZIP</span>
                    <Input
                      value={addressPostal}
                      onChange={(event) => { setAddressPostal(event.target.value); noteAddressEdited(); }}
                      autoComplete="postal-code"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={addressEnabled}
                    onChange={(event) => { setAddressEnabled(event.target.checked); noteAddressEdited(); }}
                    disabled={addressLoading}
                    style={{ marginTop: 4 }}
                  />
                  <span style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Include this address on service call sheets and handover reports.
                  </span>
                </label>
                {!addressEnabled &&
                formatAddressLine({
                  address_line_1: addressLine1,
                  address_line_2: addressLine2,
                  city: addressCity,
                  state: addressState,
                  postal_code: addressPostal
                }) ? (
                  <p style={{ color: 'var(--status-attention)', fontWeight: 600, margin: 0 }}>
                    Saved, but it will not appear anywhere until you tick the box above.
                  </p>
                ) : null}
                {formatAddressLine({
                  address_line_1: addressLine1,
                  address_line_2: addressLine2,
                  city: addressCity,
                  state: addressState,
                  postal_code: addressPostal
                }) ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14 }}>
                    Will appear as:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {formatAddressLine({
                        address_line_1: addressLine1,
                        address_line_2: addressLine2,
                        city: addressCity,
                        state: addressState,
                        postal_code: addressPostal
                      })}
                    </strong>
                  </p>
                ) : null}
                {addressError ? (
                  <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{addressError}</p>
                ) : null}
                {addressSaved ? (
                  <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">Address saved.</p>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Button type="submit" disabled={addressLoading || addressSaving}>
                    {addressSaving ? 'Saving...' : 'Save address'}
                  </Button>
                  {addressDirty ? (
                    <span style={{ color: 'var(--status-attention)', fontWeight: 600, fontSize: 14 }}>
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Security and privacy</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label="Private home record" />
              <UtilityBadge label="No sensitive access details" />
              <UtilityBadge label="Address optional" />
              <UtilityBadge label="Browser-only handover reports" />
              <UtilityBadge label="No public link is created" />
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              Saved home data belongs in your account when you are signed in. In demo mode, it is stored only in this browser.
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Do not store access codes, lock codes, garage codes, safe codes, alarm codes, Wi-Fi passwords, hidden key locations, or other sensitive entry details.
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Home Handover reports are generated in the browser from existing saved data. No public link is created, no invitation is sent, and no generated report file is stored.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionLink href="/handover" variant="secondary">Open handover builder</ActionLink>
              <ActionLink href="/sharing" variant="secondary">Open sharing review</ActionLink>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Download your data</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Take a complete copy of your home record whenever you want it — as one
              JSON file, or as spreadsheets you can open anywhere. Your record should
              outlive any single app, including this one.
            </p>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to download your data.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button type="button" onClick={() => handleExport('json')} disabled={exporting !== null}>
                    {exporting === 'json' ? 'Preparing...' : 'Download everything (JSON)'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleExport('csv')}
                    disabled={exporting !== null}
                  >
                    {exporting === 'csv' ? 'Preparing...' : 'Download spreadsheets (CSV)'}
                  </Button>
                </div>
                {exportError ? (
                  <p style={{ color: 'var(--status-urgent)', fontWeight: 700, marginBottom: 0 }} role="alert">
                    {exportError}
                  </p>
                ) : null}
                {exportNote ? (
                  <p style={{ color: 'var(--status-good)', fontWeight: 600, marginBottom: 0 }} role="status">
                    {exportNote}
                  </p>
                ) : null}
                <p style={{ color: 'var(--text-muted)', marginBottom: 0, fontSize: 14 }}>
                  The download is a complete, unredacted copy — unlike a service call
                  sheet or handover report, which deliberately leave sensitive details
                  out because someone else reads them. Uploaded files are listed but
                  not included; download those from Documents.
                </p>
              </>
            )}
          </Card>

          {process.env.NODE_ENV !== 'production' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Development tools</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Private testing tools are kept here so they do not look like normal homeowner destinations.
            </p>
            <ActionLink href="/mvp-test" variant="secondary">Open private MVP test checklist</ActionLink>
          </Card>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
            <ActionLink href="/home-map" variant="secondary">Home map</ActionLink>
          </div>
      </div>
    </>
  );
}
