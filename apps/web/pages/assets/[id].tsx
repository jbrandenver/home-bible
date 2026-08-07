import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { ASSET_TYPES, formatEnumLabel, getWarrantyMeta, safeHttpUrl, toLocalDateString, type VisibilityContext } from '@home-folder/shared';
import { PageHeader, Card, Button, ConfirmDialog, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../../components/ActionLink';
import { ViewOnlyNotice } from '../../components/ViewOnlyNotice';
import { PlateScanButton } from '../../components/PlateScanButton';
import { usePropertyAccess } from '../../lib/access';
import { VisibilityContextPicker } from '../../components/VisibilityContextPicker';
import { RelatedDocuments } from '../../components/RelatedDocuments';
import { RelatedReceipts } from '../../components/RelatedReceipts';
import {
  deleteAssetForContext,
  getAssetByIdForContext,
  getAssetDataContext,
  updateAssetForContext,
  type AssetType,
  type AssetDataContext,
  type AssetDataMode,
  type AssetRow
} from '../../lib/assets';
import { getDemoRooms } from '../../lib/demoStorage';
import {
  getDocumentDataContext,
  getDocumentsForLink,
  type DocumentDataContext,
  type DocumentRow
} from '../../lib/documents';
import { getIssueDataContext, getIssuesForAsset, type IssueRow } from '../../lib/issues';
import { getReminderDataContext, getRemindersForAsset, type ReminderRow } from '../../lib/reminders';
import { getReceiptDataContext, getReceiptsForLink, type ReceiptDataContext, type ReceiptRow } from '../../lib/receipts';
import { getRepairDataContext, getRepairsForAsset, type RepairRow } from '../../lib/repairs';
import { getRoomsForProperty } from '../../lib/rooms';
import { formatRoomLocation } from '../../lib/roomLabels';
import { formatVisibilityContextList } from '../../lib/visibility';
import { getServiceRecordDataContext, getServiceRecordsForAsset, type ServiceRecordRow } from '../../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForAsset, type TrendFlagRow } from '../../lib/trendFlags';

type Room = {
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

export default function AssetDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const assetId = typeof id === 'string' ? id : '';

  const access = usePropertyAccess();
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [documentContext, setDocumentContext] = useState<DocumentDataContext | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [receiptContext, setReceiptContext] = useState<ReceiptDataContext | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Two-step deletion: "Delete Asset" only opens this dialog. window.confirm
  // proved unreliable (a suppressed dialog returns false and the click dies
  // silently), so this uses the in-page ConfirmDialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editAssetType, setEditAssetType] = useState<AssetType>('other');
  const [editRoomId, setEditRoomId] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editRetailer, setEditRetailer] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editWarrantyLengthMonths, setEditWarrantyLengthMonths] = useState('');
  const [editWarrantyExpires, setEditWarrantyExpires] = useState('');
  const [editManualUrl, setEditManualUrl] = useState('');
  const [editSupportUrl, setEditSupportUrl] = useState('');
  const [editVisibilityContexts, setEditVisibilityContexts] = useState<VisibilityContext[]>(['personal_archive']);
  const [editNotes, setEditNotes] = useState('');


  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!assetId) {
        return;
      }

      setLoading(true);
      setError('');
      setFormError('');
      setReminderError('');
      setRepairError('');
      setServiceRecordError('');
      setDocumentError('');
      setReceiptError('');
      setIssueError('');
      setTrendFlagError('');

      try {
        const [nextContext, reminderContext, repairContext, serviceRecordContext, nextDocumentContext, nextReceiptContext, issueContext, trendFlagContext] = await Promise.all([
          getAssetDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getDocumentDataContext(),
          getReceiptDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext()
        ]);
        const nextAsset = await getAssetByIdForContext(nextContext, assetId);
        let nextReminders: ReminderRow[] = [];
        let nextRepairs: RepairRow[] = [];
        let nextServiceRecords: ServiceRecordRow[] = [];
        let nextDocuments: DocumentRow[] = [];
        let nextReceipts: ReceiptRow[] = [];
        let nextIssues: IssueRow[] = [];
        let nextTrendFlags: TrendFlagRow[] = [];

        try {
          nextReminders = await getRemindersForAsset(reminderContext, assetId);
        } catch (loadError) {
          if (isMounted) {
            setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load asset reminders.');
          }
        }

        try {
          nextRepairs = await getRepairsForAsset(repairContext, assetId);
        } catch (loadError) {
          if (isMounted) {
            setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load asset repairs.');
          }
        }

        try {
          nextServiceRecords = await getServiceRecordsForAsset(serviceRecordContext, assetId);
        } catch (loadError) {
          if (isMounted) {
            setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load asset service history.');
          }
        }

        try {
          nextDocuments = await getDocumentsForLink(nextDocumentContext, { field: 'asset_id', id: assetId });
        } catch (loadError) {
          if (isMounted) {
            setDocumentError(loadError instanceof Error ? loadError.message : 'Failed to load asset documents.');
          }
        }

        try {
          nextReceipts = await getReceiptsForLink(nextReceiptContext, { field: 'asset_id', id: assetId });
        } catch (loadError) {
          if (isMounted) {
            setReceiptError(loadError instanceof Error ? loadError.message : 'Failed to load asset receipts.');
          }
        }

        try {
          nextIssues = await getIssuesForAsset(issueContext, assetId);
        } catch (loadError) {
          if (isMounted) {
            setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load asset issues.');
          }
        }

        try {
          nextTrendFlags = await getTrendFlagsForAsset(trendFlagContext, assetId);
        } catch (loadError) {
          if (isMounted) {
            setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load asset trends.');
          }
        }

        const roomList =
          nextContext.mode === 'supabase' && nextContext.property
            ? await getRoomsForProperty(nextContext.property.id)
            : getDemoRooms();

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setAsset(nextAsset);
        setRooms(roomList);
        setReminders(nextReminders);
        setRepairs(nextRepairs);
        setServiceRecords(nextServiceRecords);
        setDocumentContext(nextDocumentContext);
        setDocuments(nextDocuments);
        setReceiptContext(nextReceiptContext);
        setReceipts(nextReceipts);
        setIssues(nextIssues);
        setTrendFlags(nextTrendFlags);
        setRoomName(
          nextAsset?.room_id
            ? formatRoomLocation(roomList.find((room: Room) => room.id === nextAsset.room_id) || { name: 'Unknown room' })
            : null
        );

        if (nextAsset) {
          setEditName(nextAsset.name);
          setEditAssetType(nextAsset.asset_type);
          setEditRoomId(nextAsset.room_id || '');
          setEditBrand(nextAsset.brand || '');
          setEditModel(nextAsset.model || '');
          setEditSerialNumber(nextAsset.serial_number || '');
          setEditRetailer(nextAsset.retailer || '');
          setEditPurchaseDate(nextAsset.purchase_date || '');
          setEditPurchasePrice(nextAsset.purchase_price === null ? '' : String(nextAsset.purchase_price));
          setEditWarrantyLengthMonths(
            nextAsset.warranty_length_months === null ? '' : String(nextAsset.warranty_length_months)
          );
          setEditWarrantyExpires(nextAsset.warranty_expires_at || '');
          setEditManualUrl(nextAsset.manual_url || '');
          setEditSupportUrl(nextAsset.support_url || '');
          setEditVisibilityContexts(nextAsset.visibility_contexts);
          setEditNotes(nextAsset.notes || '');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load asset.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

    }

    load().catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const linkedReminders = useMemo(
    () =>
      reminders.filter(
        (reminder) =>
          reminder.asset_id === assetId ||
          (reminder.linked_type === 'asset' && reminder.linked_id === assetId)
      ),
    [reminders, assetId]
  );

  const linkedServiceRecords = useMemo(
    () => serviceRecords.filter((record) => record.asset_id === assetId),
    [serviceRecords, assetId]
  );

  const warrantyDocuments = useMemo(
    () =>
      documents.filter((document) =>
        ['warranty', 'receipt', 'invoice', 'manual', 'asset_document'].includes(document.document_type)
      ),
    [documents]
  );

  const linkedRepairs = useMemo(
    () => repairs.filter((repair) => repair.asset_id === assetId),
    [repairs, assetId]
  );

  const linkedIssues = useMemo(() => issues.filter((issue) => issue.asset_id === assetId), [issues, assetId]);

  const requestDelete = () => {
    if (!asset || !context) return;
    setFormError('');
    setConfirmingDelete(true);
  };

  const handleDelete = async () => {
    if (!asset || !context || deleting) return;

    setDeleting(true);
    setError('');

    try {
      await deleteAssetForContext(context, asset.id);
      router.push('/assets');
    } catch (deleteError) {
      // Close the dialog so the error is readable on the page it points at.
      setConfirmingDelete(false);
      setFormError(deleteError instanceof Error ? deleteError.message : 'Failed to delete asset.');
      setDeleting(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!asset || !context) return;

    if (!editName.trim()) {
      setFormError('Asset name is required.');
      return;
    }

    // Same rule the add form applies: links are stored only when they are real
    // http(s) addresses, so say so here rather than dropping the value on save.
    if (editManualUrl.trim() && !safeHttpUrl(editManualUrl)) {
      setFormError('The manual link needs to be a full http:// or https:// address.');
      return;
    }

    if (editSupportUrl.trim() && !safeHttpUrl(editSupportUrl)) {
      setFormError('The support link needs to be a full http:// or https:// address.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const updatedAsset = await updateAssetForContext(context, asset.id, {
        name: editName,
        asset_type: editAssetType,
        room_id: editRoomId || null,
        brand: editBrand,
        model: editModel,
        // The recall matcher keys on the serial number, so a wrong one quietly
        // costs the household its safety alerts. It has to be correctable here.
        serial_number: editSerialNumber,
        retailer: editRetailer,
        purchase_date: editPurchaseDate || null,
        purchase_price: editPurchasePrice.trim() ? Number(editPurchasePrice) : null,
        warranty_length_months: editWarrantyLengthMonths.trim() ? Number(editWarrantyLengthMonths) : null,
        warranty_expires_at: editWarrantyExpires || null,
        manual_url: editManualUrl.trim() || null,
        support_url: editSupportUrl.trim() || null,
        visibility_contexts: editVisibilityContexts,
        notes: editNotes
      });

      if (updatedAsset) {
        setAsset(updatedAsset);
        // Links and numbers come back normalised — show what was actually kept.
        setEditManualUrl(updatedAsset.manual_url || '');
        setEditSupportUrl(updatedAsset.support_url || '');
        setEditVisibilityContexts(updatedAsset.visibility_contexts);
        setRoomName(
          updatedAsset.room_id
            ? formatRoomLocation(rooms.find((room) => room.id === updatedAsset.room_id) || { name: 'Unknown room' })
            : null
        );
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Failed to update asset.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Asset" />
        <Card>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading asset...</p>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Asset error" />
        <Card>
          <p style={{ color: 'var(--status-urgent)', fontWeight: 700 }}>{error}</p>
          <ActionLink href="/assets" variant="secondary">Back to assets</ActionLink>
        </Card>
      </>
    );
  }

  if (!asset) {
    return (
      <>
        <PageHeader title="Asset not found" />
        <Card>
          <p style={{ color: 'var(--text-muted)' }}>
            This asset may not exist yet, or your setup data was cleared.
          </p>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            {dataMode === 'supabase'
              ? 'Saved to your account. If this asset was removed, it will no longer appear.'
              : 'Demo data is stored only in this browser. Add assets from the asset flow to continue.'}
          </p>
          <ActionLink href="/assets" variant="secondary">Back to assets</ActionLink>
        </Card>
      </>
    );
  }

  const warrantyMeta = getWarrantyMeta(asset);

  return (
    <>
      <PageHeader
        title={asset.name}
        description={formatEnumLabel(asset.asset_type)}
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {reminderError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {reminderError}
            </p>
          ) : null}
          {repairError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {repairError}
            </p>
          ) : null}
          {serviceRecordError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {serviceRecordError}
            </p>
          ) : null}
          {documentError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {documentError}
            </p>
          ) : null}
          {receiptError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {receiptError}
            </p>
          ) : null}
          {issueError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {issueError}
            </p>
          ) : null}
          {trendFlagError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {trendFlagError}
            </p>
          ) : null}
          {formError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              {formError}
            </p>
          ) : null}
        </Card>

        {/* Summary Card */}
        <Card>
          <h2 style={{ marginTop: 0 }}>Asset Information</h2>

          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <div>
              <strong>Type:</strong> {formatEnumLabel(asset.asset_type)}
            </div>

            {roomName && (
              <div>
                <strong>Location:</strong> {roomName}
              </div>
            )}

            {asset.brand && (
              <div>
                <strong>Brand:</strong> {asset.brand}
              </div>
            )}
            <div>
              <strong>Receipts:</strong> {receipts.length}
            </div>

            {asset.model && (
              <div>
                <strong>Model:</strong> {asset.model}
              </div>
            )}

            {asset.serial_number && (
              <div>
                <strong>Serial Number:</strong> {asset.serial_number}
              </div>
            )}

            {asset.visibility && (
              <div>
                <strong>Appears in:</strong> {formatVisibilityContextList(asset.visibility_contexts)}
              </div>
            )}
          </div>
        </Card>

        {/* Purchase Card */}
        {(asset.purchase_date || asset.purchase_price || asset.retailer) && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Purchase Details</h2>

            <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {asset.purchase_date && (
                <div>
                  <strong>Purchased:</strong> {asset.purchase_date}
                </div>
              )}

              {asset.purchase_price && (
                <div>
                  <strong>Price:</strong> ${asset.purchase_price.toFixed(2)}
                </div>
              )}

              {asset.retailer && (
                <div>
                  <strong>Retailer:</strong> {asset.retailer}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Warranty Card */}
        <Card>
          <h2 style={{ marginTop: 0 }}>Warranty</h2>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <UtilityBadge label={formatEnumLabel(warrantyMeta.status)} />
            {warrantyMeta.daysRemaining !== null && (
              <UtilityBadge label={`${warrantyMeta.daysRemaining} days`} />
            )}
            <UtilityBadge label={`${warrantyDocuments.length} warranty doc${warrantyDocuments.length === 1 ? '' : 's'}`} />
          </div>

          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {asset.warranty_length_months && (
              <div>
                <strong>Coverage:</strong> {asset.warranty_length_months} months
              </div>
            )}

            {warrantyMeta.expirationDate && (
              <div>
                <strong>Expires:</strong> {warrantyMeta.expirationDate}
              </div>
            )}

            {!warrantyMeta.expirationDate && (
              <div style={{ color: 'var(--text-muted)' }}>Add purchase date or warranty duration to calculate expiration.</div>
            )}

            <ActionLink href="/warranties" variant="secondary">Manage warranties</ActionLink>
            <ActionLink href={`/documents?assetId=${asset.id}`} variant="secondary">Add warranty document</ActionLink>
          </div>
        </Card>

        <RelatedDocuments
          documents={documents}
          context={documentContext}
          uploadHref={`/documents?assetId=${asset.id}`}
          empty="No documents linked to this asset."
        />

        <RelatedReceipts
          receipts={receipts}
          context={receiptContext}
          uploadHref={`/receipts?assetId=${asset.id}`}
          empty="No receipts linked to this asset."
        />

        {/* Documentation Card */}
        {(safeHttpUrl(asset.manual_url) || safeHttpUrl(asset.support_url)) && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Documentation</h2>

            <div style={{ display: 'grid', gap: 12 }}>
              {safeHttpUrl(asset.manual_url) && (
                <div>
                  <a
                    href={safeHttpUrl(asset.manual_url) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-strong)', textDecoration: 'none' }}
                  >
                    📄 View Manual
                  </a>
                </div>
              )}

              {safeHttpUrl(asset.support_url) && (
                <div>
                  <a
                    href={safeHttpUrl(asset.support_url) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-strong)', textDecoration: 'none' }}
                  >
                    🔗 View Support
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Notes Card */}
        {asset.notes && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Notes</h2>
            <p style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{asset.notes}</p>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit asset</h2>
          {!access.loading && !access.canWrite ? (
            <ViewOnlyNotice role={access.role} action="edit this asset" inline />
          ) : (
          <form onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Name</span>
              <input value={editName} onChange={(event) => setEditName(event.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Category</span>
                <select value={editAssetType} onChange={(event) => setEditAssetType(event.target.value as AssetType)} style={fieldStyle}>
                  {ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{formatEnumLabel(type)}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Room</span>
                <select value={editRoomId} onChange={(event) => setEditRoomId(event.target.value)} style={fieldStyle}>
                  <option value="">Not assigned</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>{formatRoomLocation(room)}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* The commonest reason to open an item again is to fill in the
                serial number nobody wrote down. Standing in front of it with a
                phone should be enough. */}
            <div style={{ marginBottom: 4 }}>
              <PlateScanButton
                signedIn={context?.mode === 'supabase'}
                label="Scan the data plate"
                onScanned={(result) => {
                  if (result.brand) setEditBrand(result.brand);
                  if (result.model_number) setEditModel(result.model_number);
                  if (result.serial_number) setEditSerialNumber(result.serial_number);
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Brand</span>
                <input value={editBrand} onChange={(event) => setEditBrand(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Model</span>
                <input value={editModel} onChange={(event) => setEditModel(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Serial number</span>
                <input value={editSerialNumber} onChange={(event) => setEditSerialNumber(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Retailer</span>
                <input value={editRetailer} onChange={(event) => setEditRetailer(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Recall notices are matched on the serial number — worth checking it against the data plate.
            </p>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Purchase date</span>
                <input type="date" value={editPurchaseDate} onChange={(event) => setEditPurchaseDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Purchase price</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPurchasePrice}
                  onChange={(event) => setEditPurchasePrice(event.target.value)}
                  style={fieldStyle}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Warranty length (months)</span>
                <input
                  type="number"
                  min="0"
                  value={editWarrantyLengthMonths}
                  onChange={(event) => setEditWarrantyLengthMonths(event.target.value)}
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Warranty expires</span>
                <input type="date" value={editWarrantyExpires} onChange={(event) => setEditWarrantyExpires(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Manual link</span>
                <input
                  type="url"
                  value={editManualUrl}
                  onChange={(event) => setEditManualUrl(event.target.value)}
                  placeholder="https://..."
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Support link</span>
                <input
                  type="url"
                  value={editSupportUrl}
                  onChange={(event) => setEditSupportUrl(event.target.value)}
                  placeholder="https://..."
                  style={fieldStyle}
                />
              </label>
            </div>

            <VisibilityContextPicker
              idPrefix="asset-edit-visibility-contexts"
              value={editVisibilityContexts}
              onChange={setEditVisibilityContexts}
              disabled={saving}
            />

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
            </label>

            <div>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
            </div>
          </form>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Trends</h2>
          {trendFlags.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No trends currently for this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {trendFlags.map((flag) => (
                <div key={flag.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{flag.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {formatEnumLabel(flag.flag_type)} • {formatEnumLabel(flag.status)} • {formatEnumLabel(flag.severity)}
                  </div>
                  {flag.description ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>{flag.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Repairs for this asset</h2>
          {linkedRepairs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No repairs linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedRepairs
                .slice()
                .sort((a, b) => new Date(b.reported_date || b.created_at).getTime() - new Date(a.reported_date || a.created_at).getTime())
                .map((repair) => (
                  <div key={repair.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{repair.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {repair.reported_date || 'No reported date'} • {formatEnumLabel(repair.repair_type)} • {formatEnumLabel(repair.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ActionLink href={`/repairs/${repair.id}`} variant="secondary">View repair</ActionLink>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/repairs" variant="secondary">Open repairs</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Service History for this asset</h2>
          {linkedServiceRecords.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No service history linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.next_service_date && (
                      <div style={{ color: 'var(--color-brass-deep)', fontSize: '0.875rem' }}>
                        Next service: {record.next_service_date}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/repairs" variant="secondary">Open repairs</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issues for this asset</h2>
          {linkedIssues.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No issues linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedIssues
                .slice()
                .sort((a, b) => new Date(b.first_seen_date || b.created_at).getTime() - new Date(a.first_seen_date || a.created_at).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {issue.first_seen_date || 'Not set'} • {formatEnumLabel(issue.issue_type)} • {formatEnumLabel(issue.status)}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <ActionLink href={`/issues/${issue.id}`} variant="secondary">View issue</ActionLink>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/issues" variant="secondary">Open issues</ActionLink>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Reminders for this asset</h2>
          {linkedReminders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No reminders linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{
                    padding: 12,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.status)} •{' '}
                    {formatEnumLabel(reminder.reminder_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <ActionLink href="/reminders" variant="secondary">Open reminders</ActionLink>
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionLink href="/assets" variant="secondary">Back to assets</ActionLink>

          {access.loading || access.canWrite ? (
          <button
            onClick={requestDelete}
            disabled={deleting}
            style={{
              padding: '10px 16px',
              backgroundColor: 'rgba(163,78,51,0.12)',
              color: 'var(--status-urgent)',
              border: '1px solid rgba(163,78,51,0.30)',
              borderRadius: 6,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: deleting ? 0.7 : 1
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Asset'}
          </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${asset.name}?`}
        description="This cannot be undone."
        confirmLabel="Delete asset"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) {
            setConfirmingDelete(false);
          }
        }}
      />
    </>
  );
}
