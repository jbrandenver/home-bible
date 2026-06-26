import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';

type Asset = {
  id: string;
  name: string;
  brand?: string | null;
  asset_type: string;
  room_id?: string | null;
  room_name?: string | null;
  purchase_date?: string | null;
  warranty_length_months?: number | null;
  warranty_expires_at?: string | null;
  manual_url?: string | null;
  support_url?: string | null;
  updated_at?: string | null;
};

function getWarrantyMeta(asset: Asset): {
  status: 'active' | 'expiring_soon' | 'expired' | 'unknown';
  daysRemaining: number | null;
  expirationDate: string | null;
} {
  let expirationDate: Date | null = null;

  if (asset.warranty_expires_at) {
    expirationDate = new Date(asset.warranty_expires_at);
  } else if (asset.purchase_date && asset.warranty_length_months) {
    const purchaseDate = new Date(asset.purchase_date);
    expirationDate = new Date(purchaseDate);
    expirationDate.setMonth(expirationDate.getMonth() + asset.warranty_length_months);
  }

  if (!expirationDate || Number.isNaN(expirationDate.getTime())) {
    return { status: 'unknown', daysRemaining: null, expirationDate: null };
  }

  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#d1fae5';
    case 'expiring_soon':
      return '#fef3c7';
    case 'expired':
      return '#fee2e2';
    default:
      return '#f3f4f6';
  }
}

function getStatusTextColor(status: string): string {
  switch (status) {
    case 'active':
      return '#065f46';
    case 'expiring_soon':
      return '#92400e';
    case 'expired':
      return '#7f1d1d';
    default:
      return '#4b5563';
  }
}

export default function WarrantiesPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    purchase_date: '',
    warranty_length_months: '',
    warranty_expires_at: '',
    support_url: '',
    manual_url: ''
  });

  useEffect(() => {
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    if (storedAssets) {
      setAssets(JSON.parse(storedAssets));
    }
  }, []);

  const assetsByStatus = useMemo(
    () => ({
      active: assets.filter((a) => getWarrantyMeta(a).status === 'active'),
      expiring_soon: assets.filter((a) => getWarrantyMeta(a).status === 'expiring_soon'),
      expired: assets.filter((a) => getWarrantyMeta(a).status === 'expired'),
      unknown: assets.filter((a) => getWarrantyMeta(a).status === 'unknown')
    }),
    [assets]
  );

  const startEditing = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setDraft({
      purchase_date: asset.purchase_date || '',
      warranty_length_months:
        asset.warranty_length_months !== undefined && asset.warranty_length_months !== null
          ? String(asset.warranty_length_months)
          : '',
      warranty_expires_at: asset.warranty_expires_at || '',
      support_url: asset.support_url || '',
      manual_url: asset.manual_url || ''
    });
  };

  const saveWarrantyChanges = (assetId: string) => {
    const updatedAssets = assets.map((asset) => {
      if (asset.id !== assetId) {
        return asset;
      }

      return {
        ...asset,
        purchase_date: draft.purchase_date || null,
        warranty_length_months: draft.warranty_length_months ? Number(draft.warranty_length_months) : null,
        warranty_expires_at: draft.warranty_expires_at || null,
        support_url: draft.support_url || null,
        manual_url: draft.manual_url || null,
        updated_at: new Date().toISOString()
      };
    });

    setAssets(updatedAssets);
    window.localStorage.setItem('homeBible.assets', JSON.stringify(updatedAssets));
    setEditingAssetId(null);
  };

  const renderAssetGroup = (status: string, statusAssets: Asset[]) => {
    if (statusAssets.length === 0) return null;

    return (
      <div key={status} style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, color: getStatusTextColor(status) }}>
          {formatEnumLabel(status)} ({statusAssets.length})
        </h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {statusAssets.map((asset) => {
            const { status: assetStatus, daysRemaining, expirationDate } = getWarrantyMeta(asset);
            const isEditing = editingAssetId === asset.id;

            return (
              <Card key={asset.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0' }}>{asset.name}</h4>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div
                        style={{
                          padding: '4px 8px',
                          backgroundColor: getStatusColor(assetStatus),
                          color: getStatusTextColor(assetStatus),
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        {formatEnumLabel(assetStatus)}
                        {daysRemaining !== null && ` (${daysRemaining}d)`}
                      </div>
                      {asset.brand && <UtilityBadge label={asset.brand} />}
                    </div>

                    <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
                      {expirationDate && (
                        <div>
                          <strong>Expires:</strong> {expirationDate}
                        </div>
                      )}
                      {asset.purchase_date && asset.warranty_length_months && (
                        <div>
                          <strong>Coverage:</strong> {asset.warranty_length_months} months from {asset.purchase_date}
                        </div>
                      )}
                      {asset.manual_url && (
                        <div>
                          <a
                            href={asset.manual_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#3b82f6', textDecoration: 'none' }}
                          >
                            📄 Manual
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
                            🔗 Support
                          </a>
                        </div>
                      )}

                      {isEditing && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: 12,
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            background: '#f9fafb',
                            display: 'grid',
                            gap: 8
                          }}
                        >
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Purchase date</span>
                            <input
                              type="date"
                              value={draft.purchase_date}
                              onChange={(e) => setDraft((prev) => ({ ...prev, purchase_date: e.target.value }))}
                              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Warranty length (months)</span>
                            <input
                              type="number"
                              min={0}
                              value={draft.warranty_length_months}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, warranty_length_months: e.target.value }))
                              }
                              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Warranty expiration date</span>
                            <input
                              type="date"
                              value={draft.warranty_expires_at}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, warranty_expires_at: e.target.value }))
                              }
                              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Support URL</span>
                            <input
                              type="url"
                              value={draft.support_url}
                              onChange={(e) => setDraft((prev) => ({ ...prev, support_url: e.target.value }))}
                              placeholder="https://"
                              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>Manual URL</span>
                            <input
                              type="url"
                              value={draft.manual_url}
                              onChange={(e) => setDraft((prev) => ({ ...prev, manual_url: e.target.value }))}
                              placeholder="https://"
                              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <Button type="button" onClick={() => saveWarrantyChanges(asset.id)}>
                              Save
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingAssetId(null)}
                              style={{
                                padding: '10px 16px',
                                backgroundColor: '#f3f4f6',
                                color: '#111827',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button type="button" onClick={() => startEditing(asset)}>
                      Edit warranty
                    </Button>
                    <Link href={`/assets/${asset.id}`}>
                      <Button type="button">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (assets.length === 0) {
    return (
      <>
        <PageHeader
          title="Warranties"
          description="Track warranty coverage for your appliances and tools"
        />
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <h2>No assets with warranty info yet</h2>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>
              Add assets and enter warranty information to track coverage here.
            </p>
            <Link href="/add-asset">
              <Button type="button">Add your first asset</Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Warranties"
        description="Track warranty coverage for your appliances and tools"
      />

      <Card>
        <h2 style={{ marginTop: 0 }}>Warranty Summary</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <UtilityBadge label={`${assetsByStatus.active.length} active`} />
          <UtilityBadge label={`${assetsByStatus.expiring_soon.length} expiring soon`} />
          <UtilityBadge label={`${assetsByStatus.expired.length} expired`} />
          <UtilityBadge label={`${assetsByStatus.unknown.length} unknown`} />
        </div>
      </Card>

      <div style={{ marginTop: 24 }}>
        {renderAssetGroup('active', assetsByStatus.active)}
        {renderAssetGroup('expiring_soon', assetsByStatus.expiring_soon)}
        {renderAssetGroup('expired', assetsByStatus.expired)}
        {renderAssetGroup('unknown', assetsByStatus.unknown)}
      </div>
    </>
  );
}
