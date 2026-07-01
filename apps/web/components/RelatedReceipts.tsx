import { useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { Button, Card, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from './ActionLink';
import { createDocumentSignedUrlForContext, type DocumentDataContext } from '../lib/documents';
import { formatReceiptAmount, type ReceiptDataContext, type ReceiptRow } from '../lib/receipts';

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

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
      {receipts.length === 0 ? (
        <p style={{ color: '#6b7280' }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {receipts.map((receipt) => {
            const isActing = actingReceiptId === receipt.id;
            const titleText = receipt.vendor_name || receipt.description || 'Receipt';

            return (
              <div key={receipt.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{titleText}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {receipt.purchase_date || 'No date'} • {formatReceiptAmount(receipt)}
                    </div>
                  </div>
                  <UtilityBadge label={formatEnumLabel(receipt.category)} />
                </div>
                {receipt.notes ? (
                  <p style={{ color: '#4b5563', marginBottom: 8 }}>{receipt.notes}</p>
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
      <div style={{ marginTop: 12 }}>
        <ActionLink href={uploadHref} variant="secondary">Add receipt</ActionLink>
      </div>
    </Card>
  );
}
