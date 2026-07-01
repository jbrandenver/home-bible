import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { ASSET_TYPES, formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../../components/ActionLink';
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
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editAssetType, setEditAssetType] = useState<AssetType>('other');
  const [editRoomId, setEditRoomId] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editRetailer, setEditRetailer] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editWarrantyExpires, setEditWarrantyExpires] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const getWarrantyMeta = (assetItem: AssetRow) => {
    let expirationDate: Date | null = null;

    if (assetItem.warranty_expires_at) {
      expirationDate = new Date(assetItem.warranty_expires_at);
    } else if (assetItem.purchase_date && assetItem.warranty_length_months) {
      const purchaseDate = new Date(assetItem.purchase_date);
      expirationDate = new Date(purchaseDate);
      expirationDate.setMonth(expirationDate.getMonth() + assetItem.warranty_length_months);
    }

    if (!expirationDate || Number.isNaN(expirationDate.getTime())) {
      return { status: 'unknown', daysRemaining: null, expirationDate: null };
    }

    const daysRemaining = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return {
        status: 'expired',
        daysRemaining,
        expirationDate: expirationDate.toISOString().slice(0, 10)
      };
    }

    if (daysRemaining <= 30) {
      return {
        status: 'expiring_soon',
        daysRemaining,
        expirationDate: expirationDate.toISOString().slice(0, 10)
      };
    }

    return {
      status: 'active',
      daysRemaining,
      expirationDate: expirationDate.toISOString().slice(0, 10)
    };
  };

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
          setEditRetailer(nextAsset.retailer || '');
          setEditPurchaseDate(nextAsset.purchase_date || '');
          setEditWarrantyExpires(nextAsset.warranty_expires_at || '');
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

    load();

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

  const handleDelete = async () => {
    if (!asset || !context) return;

    setDeleting(true);
    setError('');

    try {
      await deleteAssetForContext(context, asset.id);
      router.push('/assets');
    } catch (deleteError) {
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

    setSaving(true);
    setFormError('');

    try {
      const updatedAsset = await updateAssetForContext(context, asset.id, {
        name: editName,
        asset_type: editAssetType,
        room_id: editRoomId || null,
        brand: editBrand,
        model: editModel,
        retailer: editRetailer,
        purchase_date: editPurchaseDate || null,
        warranty_expires_at: editWarrantyExpires || null,
        notes: editNotes
      });

      if (updatedAsset) {
        setAsset(updatedAsset);
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
          <p style={{ color: '#6b7280', margin: 0 }}>Loading asset...</p>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Asset error" />
        <Card>
          <p style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</p>
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
          <p style={{ color: '#6b7280' }}>
            This asset may not exist yet, or your setup data was cleared.
          </p>
          <p style={{ color: '#6b7280', marginTop: 8 }}>
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
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {reminderError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {reminderError}
            </p>
          ) : null}
          {repairError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {repairError}
            </p>
          ) : null}
          {serviceRecordError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {serviceRecordError}
            </p>
          ) : null}
          {documentError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {documentError}
            </p>
          ) : null}
          {receiptError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {receiptError}
            </p>
          ) : null}
          {issueError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {issueError}
            </p>
          ) : null}
          {trendFlagError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {trendFlagError}
            </p>
          ) : null}
          {formError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {formError}
            </p>
          ) : null}
        </Card>

        {/* Summary Card */}
        <Card>
          <h2 style={{ marginTop: 0 }}>Asset Information</h2>

          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: '#4b5563' }}>
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

            <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: '#4b5563' }}>
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

          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: '#4b5563' }}>
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
              <div style={{ color: '#6b7280' }}>Add purchase date or warranty duration to calculate expiration.</div>
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
        {(asset.manual_url || asset.support_url) && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Documentation</h2>

            <div style={{ display: 'grid', gap: 12 }}>
              {asset.manual_url && (
                <div>
                  <a
                    href={asset.manual_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
                  >
                    📄 View Manual
                  </a>
                </div>
              )}

              {asset.support_url && (
                <div>
                  <a
                    href={asset.support_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none' }}
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
            <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap' }}>{asset.notes}</p>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Edit asset</h2>
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
                <span style={{ fontWeight: 600 }}>Retailer</span>
                <input value={editRetailer} onChange={(event) => setEditRetailer(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Purchase date</span>
                <input type="date" value={editPurchaseDate} onChange={(event) => setEditPurchaseDate(event.target.value)} style={fieldStyle} />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Warranty expires</span>
                <input type="date" value={editWarrantyExpires} onChange={(event) => setEditWarrantyExpires(event.target.value)} style={fieldStyle} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} style={{ ...fieldStyle, minHeight: 72 }} />
            </label>

            <div>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Trends</h2>
          {trendFlags.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No trends currently for this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {trendFlags.map((flag) => (
                <div key={flag.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{flag.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {formatEnumLabel(flag.flag_type)} • {formatEnumLabel(flag.status)} • {formatEnumLabel(flag.severity)}
                  </div>
                  {flag.description ? (
                    <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>{flag.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Repairs for this asset</h2>
          {linkedRepairs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No repairs linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedRepairs
                .slice()
                .sort((a, b) => new Date(b.reported_date || b.created_at).getTime() - new Date(a.reported_date || a.created_at).getTime())
                .map((repair) => (
                  <div key={repair.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{repair.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
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
            <p style={{ color: '#6b7280' }}>No service history linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.next_service_date && (
                      <div style={{ color: '#92400e', fontSize: '0.875rem' }}>
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
            <p style={{ color: '#6b7280' }}>No issues linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedIssues
                .slice()
                .sort((a, b) => new Date(b.first_seen_date || b.created_at).getTime() - new Date(a.first_seen_date || a.created_at).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
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
            <p style={{ color: '#6b7280' }}>No reminders linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
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

          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '10px 16px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: 6,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: deleting ? 0.7 : 1
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Asset'}
          </button>
        </div>
      </div>
    </>
  );
}
