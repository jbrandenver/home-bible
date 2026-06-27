import Link from 'next/link';
import { useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { Button, Card, UtilityBadge } from '@home-bible/ui';
import {
  createDocumentSignedUrlForContext,
  formatFileSize,
  type DocumentDataContext,
  type DocumentRow
} from '../lib/documents';

type RelatedDocumentsProps = {
  title?: string;
  empty?: string;
  documents: DocumentRow[];
  context: DocumentDataContext | null;
  uploadHref: string;
};

export function RelatedDocuments({
  title = 'Documents',
  empty = 'No documents linked yet.',
  documents,
  context,
  uploadHref
}: RelatedDocumentsProps) {
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const openDocument = async (documentId: string) => {
    if (!context) {
      setError('Document storage is still loading. Please try again.');
      return;
    }

    setActingDocumentId(documentId);
    setError('');

    try {
      const { signedUrl } = await createDocumentSignedUrlForContext(context, documentId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open document.');
    } finally {
      setActingDocumentId(null);
    }
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
      {documents.length === 0 ? (
        <p style={{ color: '#6b7280' }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {documents.map((document) => {
            const isActing = actingDocumentId === document.id;

            return (
              <div key={document.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{document.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {document.file_name} • {formatFileSize(document.file_size_bytes)}
                    </div>
                  </div>
                  <UtilityBadge label={formatEnumLabel(document.document_type)} />
                </div>
                {document.description ? (
                  <p style={{ color: '#4b5563', marginBottom: 8 }}>{document.description}</p>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <Button type="button" onClick={() => openDocument(document.id)} disabled={isActing}>
                    {isActing ? 'Opening...' : 'View / download'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Link href={uploadHref}>
          <Button type="button">Add document</Button>
        </Link>
      </div>
    </Card>
  );
}
