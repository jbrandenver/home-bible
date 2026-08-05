import { useId, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-folder/shared';
import { Button, Card, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from './ActionLink';
import {
  buildDocumentFilingPatch,
  createDocumentSignedUrlForContext,
  formatFileSize,
  getDocumentsForContext,
  isDocumentLinkedTo,
  parseDocumentLinkTargetFromHref,
  updateDocumentMetadataForContext,
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
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [choices, setChoices] = useState<DocumentRow[]>([]);
  const [chosenId, setChosenId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attached, setAttached] = useState<DocumentRow[]>([]);
  const pickerId = useId();

  // The host record is read from the "add document" href, so every page that
  // already passes one gets the attach control without changing its call.
  const linkTarget = useMemo(() => parseDocumentLinkTargetFromHref(uploadHref), [uploadHref]);
  const canAttach = Boolean(linkTarget) && context?.mode === 'supabase' && Boolean(context.property);

  const visibleDocuments = useMemo(() => {
    const alreadyListed = new Set(documents.map((document) => document.id));
    return [...documents, ...attached.filter((document) => !alreadyListed.has(document.id))];
  }, [attached, documents]);

  const openDocument = async (documentId: string) => {
    if (!context) {
      setError('File details are still loading. Please try again.');
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

  const openPicker = async () => {
    if (!context || !linkTarget) {
      return;
    }

    setPickerOpen(true);
    setError('');
    setNotice('');
    setLoadingChoices(true);

    try {
      const all = await getDocumentsForContext(context);
      const linkedHere = new Set(visibleDocuments.map((document) => document.id));
      setChoices(
        all.filter((document) => !linkedHere.has(document.id) && !isDocumentLinkedTo(document, linkTarget))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load your documents.');
    } finally {
      setLoadingChoices(false);
    }
  };

  const attachDocument = async () => {
    if (!context || !linkTarget || !chosenId) {
      return;
    }

    setAttaching(true);
    setError('');
    setNotice('');

    try {
      const updated = await updateDocumentMetadataForContext(
        context,
        chosenId,
        buildDocumentFilingPatch(linkTarget)
      );

      if (updated) {
        setAttached((current) => [...current, updated]);
        setNotice(`${updated.title} is now filed here.`);
      }

      setChoices((current) => current.filter((document) => document.id !== chosenId));
      setChosenId('');
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach the document.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {error ? <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p> : null}
      {notice ? <p style={{ color: 'var(--status-good)', fontWeight: 700 }}>{notice}</p> : null}
      {visibleDocuments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleDocuments.map((document) => {
            const isActing = actingDocumentId === document.id;

            return (
              <div key={document.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{document.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {document.file_name} • {formatFileSize(document.file_size_bytes)}
                    </div>
                  </div>
                  <UtilityBadge label={formatEnumLabel(document.document_type)} />
                </div>
                {document.description ? (
                  <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{document.description}</p>
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
            <span>Document already in your folder</span>
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
            <option value="">{loadingChoices ? 'Loading your documents…' : 'Choose a document'}</option>
            {choices.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title} — {formatEnumLabel(document.document_type)}
              </option>
            ))}
          </select>
          {!loadingChoices && choices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Every document in your folder is already filed here or elsewhere in this record.
            </p>
          ) : null}
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            A document is filed under one record, so attaching it here moves it from wherever it sits now.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" onClick={attachDocument} disabled={!chosenId || attaching}>
              {attaching ? 'Attaching...' : 'Attach document'}
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
        <ActionLink href={uploadHref} variant="secondary">Add document</ActionLink>
        {canAttach && !pickerOpen ? (
          <Button type="button" variant="secondary" onClick={openPicker}>
            Attach an existing document
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
