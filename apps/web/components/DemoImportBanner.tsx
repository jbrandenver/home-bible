import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@home-folder/ui';
import {
  clearDemoData,
  importDemoDataIntoAccount,
  summarizeDemoData,
  type DemoSummary,
  type ImportResult
} from '../lib/demoImport';
import { getAssetDataContext } from '../lib/assets';
import { getIssueDataContext } from '../lib/issues';
import { getReminderDataContext } from '../lib/reminders';
import { getRepairDataContext } from '../lib/repairs';
import { getServiceRecordDataContext } from '../lib/serviceRecords';
import { getUtilityDataContext } from '../lib/utilities';

/**
 * Offers to move a signed-out demo home into the account the person just
 * created. Renders nothing unless there is genuinely something to move, so it
 * stays out of the way for everyone else.
 */
export function DemoImportBanner({
  propertyId,
  onImported
}: {
  propertyId: string | null;
  onImported?: () => void;
}) {
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setSummary(summarizeDemoData());
  }, []);

  const handleImport = useCallback(async () => {
    if (!propertyId) return;

    setImporting(true);
    setError('');

    try {
      const [utility, asset, reminder, repair, serviceRecord, issue] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext(),
        getReminderDataContext(),
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getIssueDataContext()
      ]);

      const importResult = await importDemoDataIntoAccount(propertyId, {
        utility,
        asset,
        reminder,
        repair,
        serviceRecord,
        issue
      });

      setResult(importResult);

      // Only clear the browser copy once everything landed — otherwise the
      // failed records would be destroyed along with the imported ones.
      if (Object.keys(importResult.failed).length === 0) {
        clearDemoData();
      }

      onImported?.();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Could not import your demo home. Nothing was removed from this browser.'
      );
    } finally {
      setImporting(false);
    }
  }, [propertyId, onImported]);

  const handleDiscard = useCallback(() => {
    if (
      !window.confirm(
        'Discard the demo home stored in this browser? This cannot be undone, and it will not affect anything already saved to your account.'
      )
    ) {
      return;
    }

    clearDemoData();
    setDismissed(true);
  }, []);

  if (dismissed || !summary?.hasAnything) {
    return null;
  }

  if (result) {
    const movedParts = Object.entries(result.imported)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${count} ${label}`);
    const failedParts = Object.entries(result.failed)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${count} ${label}`);

    return (
      <Card>
        <h2 style={{ marginTop: 0 }}>Demo home imported</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          {movedParts.length > 0
            ? `Moved into your account: ${movedParts.join(', ')}.`
            : 'There was nothing left to move.'}
        </p>
        {failedParts.length > 0 ? (
          <p style={{ color: 'var(--status-attention)', fontWeight: 600, marginBottom: 0 }}>
            {failedParts.join(', ')} could not be imported, so the browser copy has been kept.
            Try again, or re-enter those by hand.
          </p>
        ) : null}
      </Card>
    );
  }

  const parts = Object.entries(summary.counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Bring your demo home into this account</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
        You recorded{summary.propertyNickname ? ` ${summary.propertyNickname}` : ' a home'} in this
        browser before signing in: {parts.join(', ')}. That copy is not saved to your account yet.
      </p>
      {!propertyId ? (
        <p style={{ color: 'var(--status-attention)', fontWeight: 600 }}>
          Create a property first, then come back here to import it.
        </p>
      ) : null}
      {error ? (
        <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button onClick={handleImport} disabled={importing || !propertyId}>
          {importing ? 'Importing...' : 'Import into my account'}
        </Button>
        <Button variant="secondary" onClick={handleDiscard} disabled={importing}>
          Discard the browser copy
        </Button>
      </div>
    </Card>
  );
}
