import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { RECEIPT_CATEGORIES, formatEnumLabel, type ReceiptCategory } from '@home-bible/shared';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { createDocumentSignedUrlForContext, formatFileSize, getDocumentDataContext, getDocumentsForContext, type DocumentDataContext, type DocumentRow } from '../lib/documents';
import { getDemoRooms } from '../lib/demoStorage';
import {
  approveReceiptForContext,
  deleteReceiptForContext,
  formatReceiptAmount,
  getReceiptDataContext,
  getReceiptsForContext,
  updateReceiptForContext,
  uploadReceiptDocumentForContext,
  type ReceiptDataContext,
  type ReceiptLinkField,
  type ReceiptRow
} from '../lib/receipts';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type LinkKind = 'property' | ReceiptLinkField;

type LinkOption = {
  id: string;
  label: string;
};

type RoomOption = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

const fieldStyle = {
  padding: 10,
  borderRadius: 4,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-card)'
};

const LINK_KINDS: Array<{ value: LinkKind; label: string }> = [
  { value: 'property', label: 'Property' },
  { value: 'room_id', label: 'Room' },
  { value: 'asset_id', label: 'Asset' },
  { value: 'utility_id', label: 'Utility' },
  { value: 'repair_id', label: 'Repair' },
  { value: 'service_record_id', label: 'Service History' }
];

const QUERY_TO_LINK_KIND: Record<string, LinkKind> = {
  roomId: 'room_id',
  assetId: 'asset_id',
  utilityId: 'utility_id',
  repairId: 'repair_id',
  serviceRecordId: 'service_record_id'
};

function getInitialLink(routerQuery: Record<string, string | string[] | undefined>) {
  for (const [queryKey, linkKind] of Object.entries(QUERY_TO_LINK_KIND)) {
    const value = routerQuery[queryKey];
    if (typeof value === 'string' && value) {
      return { linkKind, linkId: value };
    }
  }

  return { linkKind: 'property' as LinkKind, linkId: '' };
}

function nullableAmount(value: string) {
  if (!value.trim()) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function buildLinkPayload(linkKind: LinkKind, linkId: string) {
  if (linkKind === 'property' || !linkId) {
    return {};
  }

  return { [linkKind]: linkId };
}

function getReceiptLinkKind(receipt: ReceiptRow): { linkKind: LinkKind; linkId: string } {
  if (receipt.room_id) return { linkKind: 'room_id', linkId: receipt.room_id };
  if (receipt.asset_id) return { linkKind: 'asset_id', linkId: receipt.asset_id };
  if (receipt.utility_id) return { linkKind: 'utility_id', linkId: receipt.utility_id };
  if (receipt.repair_id) return { linkKind: 'repair_id', linkId: receipt.repair_id };
  if (receipt.service_record_id) return { linkKind: 'service_record_id', linkId: receipt.service_record_id };
  return { linkKind: 'property', linkId: '' };
}

function getDocumentLinkKind(document: DocumentRow): { linkKind: LinkKind; linkId: string } {
  if (document.room_id) return { linkKind: 'room_id', linkId: document.room_id };
  if (document.asset_id) return { linkKind: 'asset_id', linkId: document.asset_id };
  if (document.utility_id) return { linkKind: 'utility_id', linkId: document.utility_id };
  if (document.repair_id) return { linkKind: 'repair_id', linkId: document.repair_id };
  if (document.service_record_id) return { linkKind: 'service_record_id', linkId: document.service_record_id };
  return { linkKind: 'property', linkId: '' };
}

function labelFromOptions(options: LinkOption[], id: string | null) {
  if (!id) return null;
  return options.find((option) => option.id === id)?.label || 'Unknown';
}

function getLinkLabel(linkKind: LinkKind, linkId: string, optionsByKind: Record<LinkKind, LinkOption[]>) {
  if (linkKind === 'property') return 'Property';
  const label = labelFromOptions(optionsByKind[linkKind], linkId);
  return `${LINK_KINDS.find((kind) => kind.value === linkKind)?.label || 'Record'}: ${label || 'Unknown'}`;
}

export default function ReceiptsPage() {
  const router = useRouter();

  const [context, setContext] = useState<ReceiptDataContext | null>(null);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingReceiptId, setActingReceiptId] = useState<string | null>(null);
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [uploadLinkKind, setUploadLinkKind] = useState<LinkKind>('property');
  const [uploadLinkId, setUploadLinkId] = useState('');

  const [pendingDocument, setPendingDocument] = useState<DocumentRow | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [category, setCategory] = useState<ReceiptCategory>('other');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [reviewLinkKind, setReviewLinkKind] = useState<LinkKind>('property');
  const [reviewLinkId, setReviewLinkId] = useState('');

  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const initialLink = getInitialLink(router.query);
    setUploadLinkKind(initialLink.linkKind);
    setUploadLinkId(initialLink.linkId);
    setReviewLinkKind(initialLink.linkKind);
    setReviewLinkId(initialLink.linkId);
  }, [router.isReady, router.query]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const [nextContext, nextDocumentContext, utilityContext, assetContext, repairContext, serviceRecordContext] =
          await Promise.all([
            getReceiptDataContext(),
            getDocumentDataContext(),
            getUtilityDataContext(),
            getAssetDataContext(),
            getRepairDataContext(),
            getServiceRecordDataContext()
          ]);

        const [nextReceipts, nextDocuments, roomRows, utilityRows, assetRows, repairRows, serviceRows] =
          await Promise.all([
            getReceiptsForContext(nextContext),
            getDocumentsForContext(nextDocumentContext),
            nextContext.mode === 'supabase' && nextContext.property
              ? getRoomsForProperty(nextContext.property.id)
              : Promise.resolve(getDemoRooms()),
            getUtilitiesForContext(utilityContext),
            getAssetsForContext(assetContext),
            getRepairsForContext(repairContext),
            getServiceRecordsForContext(serviceRecordContext)
          ]);

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDocumentContext(nextDocumentContext);
        setReceipts(nextReceipts);
        setDocuments(nextDocuments);
        setRooms(roomRows);
        setUtilities(utilityRows);
        setAssets(assetRows);
        setRepairs(repairRows);
        setServiceRecords(serviceRows);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load receipts.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const optionsByKind = useMemo<Record<LinkKind, LinkOption[]>>(
    () => ({
      property: context?.property ? [{ id: context.property.id, label: context.property.nickname }] : [],
      room_id: rooms.map((room) => ({ id: room.id, label: formatRoomLocation(room) })),
      asset_id: assets.map((asset) => ({ id: asset.id, label: asset.name })),
      utility_id: utilities.map((utility) => ({ id: utility.id, label: utility.name })),
      repair_id: repairs.map((repair) => ({ id: repair.id, label: repair.title })),
      service_record_id: serviceRecords.map((record) => ({ id: record.id, label: record.service_title }))
    }),
    [assets, context?.property, repairs, rooms, serviceRecords, utilities]
  );

  const documentMap = useMemo(() => {
    return documents.reduce<Record<string, DocumentRow>>((acc, document) => {
      acc[document.id] = document;
      return acc;
    }, {});
  }, [documents]);

  const reviewedDocumentIds = useMemo(
    () => new Set(receipts.map((receipt) => receipt.document_id).filter(Boolean) as string[]),
    [receipts]
  );

  const receiptDocumentsWithoutMetadata = useMemo(
    () =>
      documents.filter(
        (document) => document.document_type === 'receipt' && !reviewedDocumentIds.has(document.id)
      ),
    [documents, reviewedDocumentIds]
  );

  useEffect(() => {
    if (!router.isReady || pendingDocument) {
      return;
    }

    const documentId = router.query.documentId;
    if (typeof documentId !== 'string') {
      return;
    }

    const document = documents.find(
      (currentDocument) => currentDocument.id === documentId && currentDocument.document_type === 'receipt'
    );

    if (document && !reviewedDocumentIds.has(document.id)) {
      startReview(document);
    }
  }, [documents, pendingDocument, receipts, reviewedDocumentIds, router.isReady, router.query.documentId]);

  const canUpload = context?.mode === 'supabase' && Boolean(context.property);
  const currentUploadOptions = optionsByKind[uploadLinkKind] || [];
  const currentReviewOptions = optionsByKind[reviewLinkKind] || [];

  const resetReviewFields = () => {
    setVendorName('');
    setPurchaseDate('');
    setTotalAmount('');
    setTaxAmount('');
    setCurrency('USD');
    setPaymentMethod('');
    setCategory('other');
    setDescription('');
    setNotes('');
  };

  const startReview = (document: DocumentRow) => {
    const documentLink = getDocumentLinkKind(document);
    setPendingDocument(document);
    setReviewLinkKind(documentLink.linkKind);
    setReviewLinkId(documentLink.linkId);
    setDescription(document.description || '');
    setNotes('');
    setVendorName('');
    setPurchaseDate('');
    setTotalAmount('');
    setTaxAmount('');
    setCurrency('USD');
    setPaymentMethod('');
    setCategory('other');
    setNotice('Review the receipt details, then approve to save.');
  };

  const startEditing = (receipt: ReceiptRow) => {
    const receiptLink = getReceiptLinkKind(receipt);
    setEditingReceiptId(receipt.id);
    setPendingDocument(receipt.document_id ? documentMap[receipt.document_id] || null : null);
    setReviewLinkKind(receiptLink.linkKind);
    setReviewLinkId(receiptLink.linkId);
    setVendorName(receipt.vendor_name || '');
    setPurchaseDate(receipt.purchase_date || '');
    setTotalAmount(receipt.total_amount === null ? '' : String(receipt.total_amount));
    setTaxAmount(receipt.tax_amount === null ? '' : String(receipt.tax_amount));
    setCurrency(receipt.currency || 'USD');
    setPaymentMethod(receipt.payment_method || '');
    setCategory(receipt.category);
    setDescription(receipt.description || '');
    setNotes(receipt.notes || '');
    setNotice('Edit the approved receipt details, then save changes.');
  };

  const clearReview = () => {
    setPendingDocument(null);
    setEditingReceiptId(null);
    resetReviewFields();
  };

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);

    if (nextFile && !documentTitle.trim()) {
      setDocumentTitle(nextFile.name.replace(/\.[^.]+$/, ''));
    }
  };

  const uploadReceipt = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!context) {
      setError('Receipt details are still loading. Please try again.');
      return;
    }

    if (!file) {
      setError('Choose a receipt file to upload.');
      return;
    }

    if (uploadLinkKind !== 'property' && !uploadLinkId) {
      setError(`Choose a ${LINK_KINDS.find((kind) => kind.value === uploadLinkKind)?.label.toLowerCase() || 'record'} to link.`);
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');

    try {
      const document = await uploadReceiptDocumentForContext(context, {
        file,
        title: documentTitle || file.name.replace(/\.[^.]+$/, ''),
        description: documentDescription,
        ...buildLinkPayload(uploadLinkKind, uploadLinkId)
      });

      setDocuments((current) => [document, ...current]);
      setFile(null);
      setDocumentTitle('');
      setDocumentDescription('');
      startReview(document);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload receipt.');
    } finally {
      setUploading(false);
    }
  };

  const approveReceipt = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!context) {
      setError('Receipt details are still loading. Please try again.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        document_id: pendingDocument?.id || null,
        vendor_name: vendorName,
        purchase_date: purchaseDate || null,
        total_amount: nullableAmount(totalAmount),
        tax_amount: nullableAmount(taxAmount),
        currency,
        payment_method: paymentMethod,
        category,
        description,
        notes,
        ...buildLinkPayload(reviewLinkKind, reviewLinkId)
      };

      if (editingReceiptId) {
        const updated = await updateReceiptForContext(context, editingReceiptId, payload);
        if (updated) {
          setReceipts((current) => current.map((receipt) => (receipt.id === updated.id ? updated : receipt)));
        }
        setNotice('Receipt details updated.');
      } else {
        const created = await approveReceiptForContext(context, {
          ...payload,
          source: pendingDocument ? 'manual_review' : 'manual_entry'
        });
        setReceipts((current) => [created, ...current]);
        setNotice('Receipt approved and saved.');
      }

      clearReview();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save receipt.');
    } finally {
      setSaving(false);
    }
  };

  const cancelReview = () => {
    clearReview();
    setNotice('Review canceled. The uploaded receipt file was kept, but no receipt details were saved.');
  };

  const openDocument = async (documentId: string) => {
    if (!documentContext) return;

    setActingDocumentId(documentId);
    setError('');
    setNotice('');

    try {
      const { signedUrl } = await createDocumentSignedUrlForContext(documentContext, documentId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open receipt document.');
    } finally {
      setActingDocumentId(null);
    }
  };

  const deleteReceipt = async (receiptId: string) => {
    if (!context) return;

    setActingReceiptId(receiptId);
    setError('');
    setNotice('');

    try {
      await deleteReceiptForContext(context, receiptId);
      setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
      setNotice('Receipt details deleted. The original document was kept.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete receipt.');
    } finally {
      setActingReceiptId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Upload receipts, review the details, then approve and save."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={`${receipts.length} approved receipt${receipts.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${receiptDocumentsWithoutMetadata.length} awaiting review`} />
            <UtilityBadge label={context?.mode === 'supabase' ? 'Private files' : 'Demo data'} />
            {context?.property ? <UtilityBadge label={context.property.nickname} /> : null}
          </div>
          {loading ? <p style={{ color: '#6b7280' }}>Loading receipts...</p> : null}
          {error ? <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p> : null}
          {notice ? <p style={{ color: '#065f46', fontWeight: 700 }}>{notice}</p> : null}
          {context?.mode === 'demo' ? (
            <p style={{ color: '#6b7280' }}>
              Demo data is stored only in this browser. Receipt files and approved details require signing in.
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Upload receipt file</h2>
          {!canUpload ? (
            <div>
              <p style={{ color: '#6b7280' }}>Sign in and create a property to upload private receipt files. Review before saving.</p>
              <ActionLink href="/sign-in">Sign in</ActionLink>
            </div>
          ) : (
            <form onSubmit={uploadReceipt} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Receipt file</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                  style={fieldStyle}
                />
              </label>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Document title</span>
                  <input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Link to</span>
                  <select
                    value={uploadLinkKind}
                    onChange={(event) => {
                      setUploadLinkKind(event.target.value as LinkKind);
                      setUploadLinkId('');
                    }}
                    style={fieldStyle}
                  >
                    {LINK_KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>{kind.label}</option>
                    ))}
                  </select>
                </label>
                {uploadLinkKind !== 'property' ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Record</span>
                    <select value={uploadLinkId} onChange={(event) => setUploadLinkId(event.target.value)} style={fieldStyle}>
                      <option value="">Choose record</option>
                      {currentUploadOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Document note</span>
                <textarea value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
              </label>

              <div>
                <Button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload and review'}</Button>
              </div>
            </form>
          )}
        </Card>

        {pendingDocument || editingReceiptId ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>
              {editingReceiptId ? 'Edit receipt details' : 'Review the receipt before saving'}
            </h2>
            {pendingDocument ? (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>{pendingDocument.title}</div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {pendingDocument.file_name} • {formatFileSize(pendingDocument.file_size_bytes)}
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button
                    type="button"
                    onClick={() => openDocument(pendingDocument.id)}
                    disabled={actingDocumentId === pendingDocument.id}
                  >
                    {actingDocumentId === pendingDocument.id ? 'Opening...' : 'Preview receipt file'}
                  </Button>
                </div>
              </div>
            ) : null}

            <form onSubmit={approveReceipt} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Vendor name</span>
                  <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Purchase date</span>
                  <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value as ReceiptCategory)} style={fieldStyle}>
                    {RECEIPT_CATEGORIES.map((receiptCategory) => (
                      <option key={receiptCategory} value={receiptCategory}>{formatEnumLabel(receiptCategory)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Total amount</span>
                  <input type="number" min="0" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Tax amount</span>
                  <input type="number" min="0" step="0.01" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Currency</span>
                  <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))} style={fieldStyle} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Payment method</span>
                  <input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} style={fieldStyle} />
                </label>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Link receipt to</span>
                  <select
                    value={reviewLinkKind}
                    onChange={(event) => {
                      setReviewLinkKind(event.target.value as LinkKind);
                      setReviewLinkId('');
                    }}
                    style={fieldStyle}
                  >
                    {LINK_KINDS.map((kind) => (
                      <option key={kind.value} value={kind.value}>{kind.label}</option>
                    ))}
                  </select>
                </label>
                {reviewLinkKind !== 'property' ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Record</span>
                    <select value={reviewLinkId} onChange={(event) => setReviewLinkId(event.target.value)} style={fieldStyle}>
                      <option value="">Choose record</option>
                      {currentReviewOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Notes</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
              </label>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : editingReceiptId ? 'Save Receipt Changes' : 'Approve and Save Receipt'}
                </Button>
                <Button type="button" onClick={cancelReview} style={{ background: '#6b7280' }}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {receiptDocumentsWithoutMetadata.length > 0 ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Awaiting review</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {receiptDocumentsWithoutMetadata.map((document) => (
                <div key={document.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 700 }}>{document.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {document.file_name} • {formatFileSize(document.file_size_bytes)} • {new Date(document.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <Button type="button" onClick={() => startReview(document)}>Review receipt</Button>
                    <Button type="button" onClick={() => openDocument(document.id)} style={{ background: '#4b5563' }}>Preview</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 style={{ marginTop: 0 }}>Approved receipts</h2>
          {receipts.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Save receipts after you review the details.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {receipts.map((receipt) => {
                const document = receipt.document_id ? documentMap[receipt.document_id] : null;
                const receiptLink = getReceiptLinkKind(receipt);
                const isActing = actingReceiptId === receipt.id;

                return (
                  <div key={receipt.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{receipt.vendor_name || receipt.description || 'Receipt'}</div>
                        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                          {receipt.purchase_date || 'No purchase date'} • {formatReceiptAmount(receipt)} • {new Date(receipt.created_at).toLocaleDateString()}
                        </div>
                        {document ? (
                          <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                            {document.file_name} • {formatFileSize(document.file_size_bytes)}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <UtilityBadge label={formatEnumLabel(receipt.category)} />
                        <UtilityBadge label={formatEnumLabel(receipt.approval_status)} />
                      </div>
                    </div>
                    {receipt.notes ? <p style={{ color: '#4b5563' }}>{receipt.notes}</p> : null}
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 8 }}>
                      {getLinkLabel(receiptLink.linkKind, receiptLink.linkId, optionsByKind)}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {receipt.document_id ? (
                        <Button type="button" onClick={() => openDocument(receipt.document_id as string)} disabled={actingDocumentId === receipt.document_id}>
                          {actingDocumentId === receipt.document_id ? 'Opening...' : 'View / download'}
                        </Button>
                      ) : null}
                      <Button type="button" onClick={() => startEditing(receipt)} style={{ background: '#4b5563' }}>
                        Edit details
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteReceipt(receipt.id)}
                        disabled={isActing}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          cursor: isActing ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                          opacity: isActing ? 0.7 : 1
                        }}
                      >
                        {isActing ? 'Deleting...' : 'Delete details'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
          <ActionLink href="/documents" variant="secondary">Documents</ActionLink>
        </div>
      </div>
    </>
  );
}
