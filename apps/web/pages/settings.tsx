import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { formatEnumLabel, PROPERTY_TYPES } from '@home-folder/shared';
import { PageHeader, Card, Button, Input, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import {
  getCurrentUser,
  isSupabaseConfigured,
  onAuthStateChange,
  signOut
} from '../lib/auth';
import {
  deletePropertyForOwner,
  formatAddressLine,
  getPrimaryPropertyForUser,
  getPropertyAddressDetails,
  getPropertyDetails,
  updatePropertyAddress,
  updatePropertyDetails,
  type PropertySummary,
  type PropertyType
} from '../lib/properties';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import {
  DIGEST_FREQUENCIES,
  DIGEST_FREQUENCY_LABELS,
  getDigestPreferences,
  saveDigestPreferences,
  type DigestFrequency
} from '../lib/digestPreferences';
import {
  buildAccountExport,
  buildArchiveZip,
  buildCsvSheets,
  buildReadme,
  downloadBinaryFile,
  downloadTextFile,
  exceedsExportSizeWarning,
  listExportableFiles,
  totalFileSizeBytes
} from '../lib/accountExport';
import { formatFileSize } from '../lib/documents';
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

function asPropertyType(value: string | undefined): PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value ?? '')
    ? (value as PropertyType)
    : 'single_family_home';
}

// Blank means "not recorded"; anything else must be a whole number in range.
function parseOptionalWholeNumber(
  value: string,
  { min, max }: { min: number; max: number }
): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    return 'invalid';
  }

  return parsed;
}

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

  const [detailsNickname, setDetailsNickname] = useState('');
  const [detailsType, setDetailsType] = useState<PropertyType>('single_family_home');
  const [detailsUnitLabel, setDetailsUnitLabel] = useState('');
  const [detailsSquareFeet, setDetailsSquareFeet] = useState('');
  const [detailsYearBuilt, setDetailsYearBuilt] = useState('');
  const [detailsFloorCount, setDetailsFloorCount] = useState('');
  const [detailsHasGarage, setDetailsHasGarage] = useState(false);
  const [detailsHasBasement, setDetailsHasBasement] = useState(false);
  const [detailsHasAttic, setDetailsHasAttic] = useState(false);
  const [detailsHasCrawlSpace, setDetailsHasCrawlSpace] = useState(false);
  const [detailsHasYard, setDetailsHasYard] = useState(false);
  const [detailsHasShed, setDetailsHasShed] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);

  const [deletingProperty, setDeletingProperty] = useState(false);
  const [propertyDeleteError, setPropertyDeleteError] = useState('');

  const [exporting, setExporting] = useState<'archive' | 'csv' | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportNote, setExportNote] = useState('');
  const [exportProgress, setExportProgress] = useState('');

  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('monthly');
  const [visitReminders, setVisitReminders] = useState(true);
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSaved, setDigestSaved] = useState(false);
  const [digestError, setDigestError] = useState('');

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
        const [details, profile] = nextProperty
          ? await Promise.all([
              getPropertyAddressDetails(nextProperty.id),
              getPropertyDetails(nextProperty.id)
            ])
          : [null, null];

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

        setDetailsNickname(profile?.nickname || nextProperty?.nickname || '');
        setDetailsType(profile?.property_type ?? asPropertyType(nextProperty?.property_type));
        setDetailsUnitLabel(profile?.unit_label || nextProperty?.unit_label || '');
        setDetailsSquareFeet(profile?.square_feet != null ? String(profile.square_feet) : '');
        setDetailsYearBuilt(profile?.year_built != null ? String(profile.year_built) : '');
        setDetailsFloorCount(profile?.floor_count != null ? String(profile.floor_count) : '');
        setDetailsHasGarage(profile?.has_garage || false);
        setDetailsHasBasement(profile?.has_basement || false);
        setDetailsHasAttic(profile?.has_attic || false);
        setDetailsHasCrawlSpace(profile?.has_crawl_space || false);
        setDetailsHasYard(profile?.has_yard || false);
        setDetailsHasShed(profile?.has_shed || false);
        setDetailsDirty(false);
        setDetailsSaved(false);
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

  function notePropertyDetailsEdited() {
    setDetailsSaved(false);
    setDetailsDirty(true);
  }

  async function handleSavePropertyDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property) {
      return;
    }

    const currentYear = new Date().getFullYear();
    const squareFeet = parseOptionalWholeNumber(detailsSquareFeet, { min: 0, max: 10_000_000 });
    const yearBuilt = parseOptionalWholeNumber(detailsYearBuilt, { min: 1500, max: currentYear + 5 });
    const floorCount = parseOptionalWholeNumber(detailsFloorCount, { min: 0, max: 200 });

    setDetailsError('');
    setDetailsSaved(false);

    if (!detailsNickname.trim()) {
      setDetailsError('Give this property a name — it is how you tell your homes apart.');
      return;
    }

    if (squareFeet === 'invalid') {
      setDetailsError('Square feet should be a whole number, or left blank.');
      return;
    }

    if (yearBuilt === 'invalid') {
      setDetailsError(`Year built should be a four-digit year up to ${currentYear + 5}, or left blank.`);
      return;
    }

    if (floorCount === 'invalid') {
      setDetailsError('Floors should be a whole number, or left blank.');
      return;
    }

    setDetailsSaving(true);

    try {
      await updatePropertyDetails(property.id, {
        nickname: detailsNickname,
        property_type: detailsType,
        unit_label: detailsUnitLabel,
        square_feet: squareFeet,
        year_built: yearBuilt,
        floor_count: floorCount,
        has_garage: detailsHasGarage,
        has_basement: detailsHasBasement,
        has_attic: detailsHasAttic,
        has_crawl_space: detailsHasCrawlSpace,
        has_yard: detailsHasYard,
        has_shed: detailsHasShed
      });

      setProperty((current) =>
        current
          ? {
              ...current,
              nickname: detailsNickname.trim(),
              property_type: detailsType,
              unit_label: detailsUnitLabel.trim() || null
            }
          : current
      );
      setDetailsSaved(true);
      setDetailsDirty(false);
    } catch (saveError) {
      setDetailsError(saveError instanceof Error ? saveError.message : 'Failed to save the property details.');
    } finally {
      setDetailsSaving(false);
    }
  }

  // Typing a correction and navigating away used to lose it silently.
  useEffect(() => {
    if (!addressDirty && !detailsDirty) {
      return;
    }

    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnOnUnload);
    return () => window.removeEventListener('beforeunload', warnOnUnload);
  }, [addressDirty, detailsDirty]);

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    getDigestPreferences()
      .then((prefs) => {
        if (!isMounted) return;
        setDigestFrequency(prefs.frequency);
        setVisitReminders(prefs.visit_reminders);
      })
      .catch(() => {
        /* falls back to the defaults already in state */
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function handleSaveDigest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDigestSaving(true);
    setDigestError('');
    setDigestSaved(false);

    try {
      await saveDigestPreferences({ frequency: digestFrequency, visit_reminders: visitReminders });
      setDigestSaved(true);
    } catch (saveError) {
      setDigestError(saveError instanceof Error ? saveError.message : 'Could not save.');
    } finally {
      setDigestSaving(false);
    }
  }

  async function handleExport(format: 'archive' | 'csv') {
    setExporting(format);
    setExportError('');
    setExportNote('');
    setExportProgress('');

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

      if (format === 'archive') {
        // The archive carries every uploaded file the account can read, across
        // all properties. Files come down one at a time, so surface progress.
        setExportProgress('Listing your uploaded files…');
        const files = user ? await listExportableFiles(user.id) : [];

        const totalBytes = totalFileSizeBytes(files);
        if (exceedsExportSizeWarning(totalBytes)) {
          const proceed = window.confirm(
            `Your uploaded files total about ${formatFileSize(totalBytes)}. The archive is assembled in this browser tab, so a download this size can take a while and use significant memory. Continue?`
          );
          if (!proceed) {
            setExportProgress('');
            setExportNote('Export cancelled — nothing was downloaded.');
            return;
          }
        }

        const { zip, includedCount, missing } = await buildArchiveZip(data, files, (current, total) => {
          setExportProgress(`Fetching file ${current} of ${total}…`);
        });
        setExportProgress('Packaging the archive…');
        downloadBinaryFile(`home-folder-archive-${stamp}.zip`, zip);
        setExportProgress('');
        setExportNote(
          missing.length > 0
            ? `Downloaded your archive with ${includedCount} of ${files.length} files. ${missing.length} could not be fetched — see files/MISSING.txt inside the zip, then try again or download them from Documents.`
            : files.length > 0
              ? `Downloaded your full archive — every record, plus all ${includedCount} uploaded file${includedCount === 1 ? '' : 's'}.`
              : 'Downloaded your full archive. No uploaded files yet, so it holds your records and a README.'
        );
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
      setExportProgress('');
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function handleDeleteProperty() {
    if (!property) {
      return;
    }

    const label = property.nickname || 'this home';
    if (
      !window.confirm(
        `Delete ${label}? Everything recorded in it — rooms, utilities, appliances, documents, reminders, and history — is removed from your account. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingProperty(true);
    setPropertyDeleteError('');

    try {
      if (!user) {
        throw new Error('Sign in to delete this home.');
      }
      await deletePropertyForOwner(property.id, user.id);
      // A full load, not a client-side push: every cached data context and the
      // property switcher must re-resolve now that this home is gone.
      window.location.assign('/dashboard');
    } catch (deleteError) {
      setPropertyDeleteError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete this home.'
      );
      setDeletingProperty(false);
    }
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
            <h2 style={{ marginTop: 0 }}>Property details</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              What this property is, and what it has. A name typed in a hurry can be
              corrected here. The seasonal maintenance plan reads the state from the
              address above, along with whether there is a yard or a basement, so
              filling these in makes the plan match the actual home.
            </p>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to edit your property details.
              </p>
            ) : !property && !addressLoading ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Create a property first — these details belong to it.
                </p>
                <div>
                  <ActionLink href="/create-property" variant="secondary">Create property</ActionLink>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePropertyDetails} style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <label>
                    <span>Property name</span>
                    <Input
                      value={detailsNickname}
                      onChange={(event) => { setDetailsNickname(event.target.value); notePropertyDetailsEdited(); }}
                      placeholder="The Maple Street house"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>Property type</span>
                    <Select
                      value={detailsType}
                      onChange={(event) => { setDetailsType(event.target.value as PropertyType); notePropertyDetailsEdited(); }}
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    >
                      {PROPERTY_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {formatEnumLabel(value)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    <span>Unit label (optional)</span>
                    <Input
                      value={detailsUnitLabel}
                      onChange={(event) => { setDetailsUnitLabel(event.target.value); notePropertyDetailsEdited(); }}
                      placeholder="Unit 2B"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <label>
                    <span>Square feet</span>
                    <Input
                      value={detailsSquareFeet}
                      onChange={(event) => { setDetailsSquareFeet(event.target.value); notePropertyDetailsEdited(); }}
                      inputMode="numeric"
                      placeholder="1850"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>Year built</span>
                    <Input
                      value={detailsYearBuilt}
                      onChange={(event) => { setDetailsYearBuilt(event.target.value); notePropertyDetailsEdited(); }}
                      inputMode="numeric"
                      placeholder="1974"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <label>
                    <span>Floors</span>
                    <Input
                      value={detailsFloorCount}
                      onChange={(event) => { setDetailsFloorCount(event.target.value); notePropertyDetailsEdited(); }}
                      inputMode="numeric"
                      placeholder="2"
                      disabled={addressLoading}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                </div>

                <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-control)', padding: 16, margin: 0 }}>
                  <legend style={{ padding: '0 6px', fontWeight: 600 }}>What this property has</legend>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    {([
                      ['Garage', detailsHasGarage, setDetailsHasGarage],
                      ['Basement', detailsHasBasement, setDetailsHasBasement],
                      ['Attic', detailsHasAttic, setDetailsHasAttic],
                      ['Crawl space', detailsHasCrawlSpace, setDetailsHasCrawlSpace],
                      ['Yard', detailsHasYard, setDetailsHasYard],
                      ['Shed', detailsHasShed, setDetailsHasShed]
                    ] as Array<[string, boolean, (next: boolean) => void]>).map(([featureLabel, checked, setChecked]) => (
                      <label key={featureLabel} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => { setChecked(event.target.checked); notePropertyDetailsEdited(); }}
                          disabled={addressLoading}
                        />
                        <span style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {featureLabel}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {detailsError ? (
                  <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{detailsError}</p>
                ) : null}
                {detailsSaved ? (
                  <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">Property details saved.</p>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Button type="submit" disabled={addressLoading || detailsSaving}>
                    {detailsSaving ? 'Saving...' : 'Save property details'}
                  </Button>
                  {detailsDirty ? (
                    <span style={{ color: 'var(--status-attention)', fontWeight: 600, fontSize: 14 }}>
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Delete this home</h2>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to manage your properties.
              </p>
            ) : !property ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                No property to delete — create one first.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Removes <strong>{property.nickname || 'this home'}</strong> and everything
                  recorded in it — rooms, utilities, appliances, documents, reminders, and
                  history — from your account. A building takes its units with it. Your
                  account and any other homes stay. This cannot be undone.
                </p>
                {propertyDeleteError ? (
                  <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{propertyDeleteError}</p>
                ) : null}
                <div>
                  <Button
                    type="button"
                    disabled={deletingProperty}
                    onClick={handleDeleteProperty}
                    style={{ background: 'var(--status-urgent)', borderColor: 'var(--status-urgent)' }}
                  >
                    {deletingProperty ? 'Deleting...' : 'Delete this home'}
                  </Button>
                </div>
              </div>
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
            <h2 style={{ marginTop: 0 }}>Reminder emails</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              A short note about what is coming up, so nothing quietly becomes
              urgent. It lists titles and dates only — never your address, what
              you own, or anything you wrote down.
            </p>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 0 }}>
              Sending is not switched on yet — these settings are saved and will
              apply as soon as it is.
            </p>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to set up reminder emails.
              </p>
            ) : (
              <form onSubmit={handleSaveDigest} style={{ display: 'grid', gap: 14, maxWidth: 520 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span>How often</span>
                  <Select
                    value={digestFrequency}
                    onChange={(event) => {
                      setDigestFrequency(event.target.value as DigestFrequency);
                      setDigestSaved(false);
                    }}
                  >
                    {DIGEST_FREQUENCIES.map((value) => (
                      <option key={value} value={value}>
                        {DIGEST_FREQUENCY_LABELS[value]}
                      </option>
                    ))}
                  </Select>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={visitReminders}
                    onChange={(event) => {
                      setVisitReminders(event.target.checked);
                      setDigestSaved(false);
                    }}
                    style={{ marginTop: 4 }}
                  />
                  <span style={{ textTransform: 'none', letterSpacing: 'normal', fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Also remind me the day before a technician is due. Worth keeping on
                    even with monthly emails — a visit booked mid-month would otherwise
                    arrive without warning.
                  </span>
                </label>

                {digestError ? (
                  <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }} role="alert">{digestError}</p>
                ) : null}
                {digestSaved ? (
                  <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">Saved.</p>
                ) : null}

                <div>
                  <Button type="submit" disabled={digestSaving}>
                    {digestSaving ? 'Saving...' : 'Save reminder settings'}
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Download your data</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Take a complete copy of your home record whenever you want it. The full
              archive is one zip holding every record and every file you uploaded —
              photos, manuals, receipts, documents. Your record should outlive any
              single app, including this one.
            </p>
            {!supabaseReady || !user ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Sign in to download your data.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button type="button" onClick={() => handleExport('archive')} disabled={exporting !== null}>
                    {exporting === 'archive' ? 'Preparing...' : 'Download full archive (ZIP, files included)'}
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
                {exportProgress ? (
                  <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 0 }} role="status">
                    {exportProgress}
                  </p>
                ) : null}
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
                  The archive is a complete, unredacted copy — unlike a service call
                  sheet or handover report, which deliberately leave sensitive details
                  out because someone else reads them. If any file cannot be fetched
                  while the archive is built, it is listed in files/MISSING.txt inside
                  the zip rather than silently left out. The CSV download carries
                  records only.
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
