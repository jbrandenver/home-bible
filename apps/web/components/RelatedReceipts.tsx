import { useId, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from './ActionLink';
import { createDocumentSignedUrlForContext, type DocumentDataContext } from '../lib/documents';
import {
  buildReceiptFilingPatch,
  formatReceiptAmount,
  getReceiptsForContext,
  isReceiptLinkedTo,
  parseReceiptLinkTargetFromHref,
  updateReceiptForContext,
  type ReceiptDataContext,
  type ReceiptRow
} from '../lib/receipts';

type RelatedReceiptsProps = {
  title?: string;
  empty?: string;
  receipts: ReceiptRow[];
  context: ReceiptDataContext | null;
  uploadHref: string;
};

export function RelatedReceipts({
  title = 'Receipts',
  empty = 'No receipts linked yet.',
  receipts,
  context,
  uploadHref
}: RelatedReceiptsProps) {
  const [actingReceiptId, setActingReceiptId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [choices, setChoices] = useState<ReceiptRow[]>([]);
  const [chosenId, setChosenId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState<ReceiptRow[]>([]);
  const pickerId = useId();

  // The host record is read from the "add receipt" href, so every page that
  // already passes one gets the attach control without changing its call.
  const linkTarget = useMemo(() => parseReceiptLinkTargetFromHref(uploadHref), [uploadHref]);
  const canAttach = Boolean(linkTarget) && context?.mode === 'supabase' && Boolean(context.property);

  const visibleReceipts = useMemo(() => {
    const alreadyListed = new Set(receipts.map((receipt) => receipt.id));
    return [...receipts, ...attached.filter((receipt) => !alreadyListed.has(receipt.id))];
  }, [attached, receipts]);

  const openReceiptDocument = async (receipt: ReceiptRow) => {
    if (!context || !receipt.document_id) {
      return;
    }

    setActingReceiptId(receipt.id);
    setError('');

    try {
      const { signedUrl } = await createDocumentSignedUrlForContext(
        context as DocumentDataContext,
        receipt.document_id
      );
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open receipt document.');
    } finally {
      setActingReceiptId(null);
    }
  };

  const openPicker = async () => {
    if (!context || !linkTarget) {
      return;
    }

    setPickerOpen(true);
    setError('');
    setNotice('');
    setLoadingChoices(true);

    try {
      const all = await getReceiptsForContext(context);
      const linkedHere = new Set(visibleReceipts.map((receipt) => receipt.id));
      setChoices(
        all.filter((receipt) => !linkedHere.has(receipt.id) && !isReceiptLinkedTo(receipt, linkTarget))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load your receipts.');
    } finally {
      setLoadingChoices(false);
    }
  };

  const attachReceipt = async () => {
    if (!context || !linkTarget || !chosenId) {
      return;
    }

    setAttaching(true);
    setError('');
    setNotice('');

    try {
      const updated = await updateReceiptForContext(context, chosenId, buildReceiptFilingPatch(linkTarget));

      if (updated) {
        setAttached((current) => [...current, updated]);
        setNotice(`${updated.vendor_name || updated.description || 'Receipt'} is now filed here.`);
      }

      setChoices((current) => current.filter((receipt) => receipt.id !== chosenId));
      setChosenId('');
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach the receipt.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
      {notice ? <p style={{ color: 'var(--status-good)', fontWeight: 700 }}>{notice}</p> : null}
      {visibleReceipts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleReceipts.map((receipt) => {
            const isActing = actingReceiptId === receipt.id;
            const titleText = receipt.vendor_name || receipt.description || 'Receipt';

            return (
              <div key={receipt.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{titleText}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {receipt.purchase_date || 'No date'} • {formatReceiptAmount(receipt)}
                    </div>
                  </div>
                  <UtilityBadge label={formatEnumLabel(receipt.category)} />
                </div>
                {receipt.notes ? (
                  <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{receipt.notes}</p>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {receipt.document_id ? (
                    <Button type="button" onClick={() => openReceiptDocument(receipt)} disabled={isActing}>
                      {isActing ? 'Opening...' : 'View receipt'}
                    </Button>
                  ) : null}
                  <ActionLink href="/receipts" variant="secondary">All receipts</ActionLink>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canAttach && pickerOpen ? (
        <div
          style={{
            marginTop: 12,
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 12,
            display: 'grid',
            gap: 10
          }}
        >
          <label htmlFor={pickerId} style={{ fontWeight: 600 }}>
            Receipt already in your records
          </label>
          <select
            id={pickerId}
            value={chosenId}
            disabled={loadingChoices || attaching}
            onChange={(event) => setChosenId(event.target.value)}
            style={{
              padding: 10,
              borderRadius: 4,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-card)'
            }}
          >
            <option value="">{loadingChoices ? 'Loading your receipts…' : 'Choose a receipt'}</option>
            {choices.map((receipt) => (
              <option key={receipt.id} value={receipt.id}>
                {receipt.vendor_name || receipt.description || 'Receipt'} — {receipt.purchase_date || 'No date'} — {formatReceiptAmount(receipt)}
              </option>
            ))}
          </select>
          {!loadingChoices && choices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Every saved receipt is already filed here or elsewhere in this record.
            </p>
          ) : null}
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            A receipt is filed under one record, so attaching it here moves it from wherever it sits now.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" onClick={attachReceipt} disabled={!chosenId || attaching}>
              {attaching ? 'Attaching...' : 'Attach receipt'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={attaching}
              onClick={() => {
                setPickerOpen(false);
                setChosenId('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ActionLink href={uploadHref} variant="secondary">Add receipt</ActionLink>
        {canAttach && !pickerOpen ? (
          <Button type="button" variant="secondary" onClick={openPicker}>
            Attach an existing receipt
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
