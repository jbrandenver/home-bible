import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { detectTrendFlags, trendFlagsForEntity, type IssueRecord, type ServiceRecord as TrendServiceRecord } from '../../components/trendFlags';
import {
  deleteAssetForContext,
  getAssetByIdForContext,
  getAssetDataContext,
  type AssetDataContext,
  type AssetDataMode,
  type AssetRow
} from '../../lib/assets';
import { getDemoCollection, getDemoRooms } from '../../lib/demoStorage';
import { getRoomsForProperty } from '../../lib/rooms';

type Reminder = {
  id: string;
  title: string;
  reminder_type: string;
  due_date: string;
  linked_type?: string | null;
  linked_id?: string | null;
  status: string;
};

type ServiceRecord = TrendServiceRecord & {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  follow_up_needed?: boolean;
  follow_up_date?: string | null;
};

type Issue = IssueRecord & {
  id: string;
  title: string;
  issue_type: string;
  date_found: string;
};

type Room = {
  id: string;
  name: string;
};

export default function AssetDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const assetId = typeof id === 'string' ? id : '';

  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

      try {
        const nextContext = await getAssetDataContext();
        const nextAsset = await getAssetByIdForContext(nextContext, assetId);
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
        setRoomName(
          nextAsset?.room_id
            ? roomList.find((room: Room) => room.id === nextAsset.room_id)?.name || 'Unknown room'
            : null
        );
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load asset.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      if (isMounted) {
        setReminders(getDemoCollection<Reminder>('homeBible.reminders'));
        setServiceRecords(getDemoCollection<ServiceRecord>('homeBible.serviceRecords'));
        setIssues(getDemoCollection<Issue>('homeBible.issues'));
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [assetId]);

  const linkedReminders = useMemo(
    () => reminders.filter((reminder) => reminder.linked_type === 'asset' && reminder.linked_id === assetId),
    [reminders, assetId]
  );

  const linkedServiceRecords = useMemo(
    () => serviceRecords.filter((record) => record.asset_id === assetId),
    [serviceRecords, assetId]
  );

  const linkedIssues = useMemo(
    () => issues.filter((issue) => issue.asset_id === assetId),
    [issues, assetId]
  );

  const trendFlags = useMemo(() => detectTrendFlags(serviceRecords, issues), [serviceRecords, issues]);
  const assetTrendFlags = useMemo(() => trendFlagsForEntity(trendFlags, 'asset', assetId), [trendFlags, assetId]);

  const handleDelete = async () => {
    if (!asset || !context) return;

    setDeleting(true);
    setError('');

    try {
      await deleteAssetForContext(context, asset.id);
      router.push('/assets');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete asset.');
      setDeleting(false);
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
          <Link href="/assets">
            <Button type="button">Back to assets</Button>
          </Link>
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
              ? 'Signed-in mode is active. If this asset was removed, it will no longer appear.'
              : 'Demo mode is active. Add assets from the asset flow to continue.'}
          </p>
          <Link href="/assets">
            <Button type="button">Back to assets</Button>
          </Link>
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
              ? 'Signed-in mode: this asset is loaded from Supabase.'
              : 'Demo mode: this asset is loaded from localStorage.'}
          </p>
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
                <strong>Visibility:</strong> {formatEnumLabel(asset.visibility)}
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

            <Link href="/warranties">
              <Button type="button">Manage warranties</Button>
            </Link>
          </div>
        </Card>

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
          <h2 style={{ marginTop: 0 }}>Trend flags</h2>
          {assetTrendFlags.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No trend flags currently for this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {assetTrendFlags.map((flag) => (
                <div key={flag.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{flag.label}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{flag.details}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Service records for this asset</h2>
          {linkedServiceRecords.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No service records linked to this asset.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {linkedServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{record.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.follow_up_needed && (
                      <div style={{ color: '#92400e', fontSize: '0.875rem' }}>
                        Follow-up: {record.follow_up_date || 'Needed'}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/repairs">
              <Button type="button">Open repairs</Button>
            </Link>
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
                .sort((a, b) => new Date(b.date_found || 0).getTime() - new Date(a.date_found || 0).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {issue.date_found} • {formatEnumLabel(issue.issue_type)} • {formatEnumLabel(issue.status)}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/issues">
              <Button type="button">Open issues</Button>
            </Link>
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
                    {reminder.due_date} • {formatEnumLabel(reminder.status)} •{' '}
                    {formatEnumLabel(reminder.reminder_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/reminders">
              <Button type="button">Open reminders</Button>
            </Link>
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/assets">
            <Button type="button">Back to assets</Button>
          </Link>

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
