import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button } from '@home-bible/ui';

type Asset = {
  id: string;
  asset_type: string;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_price?: number;
  retailer?: string;
  warranty_length_months?: number;
  warranty_expires_at?: string;
  manual_url?: string;
  support_url?: string;
  notes?: string;
  room_id?: string;
  room_name?: string;
  visibility?: string;
  created_at?: string;
  updated_at?: string;
};

type Room = {
  id: string;
  name: string;
};

export default function AssetDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');

    if (storedAssets) {
      const parsedAssets = JSON.parse(storedAssets);
      const parsedRooms = storedRooms ? JSON.parse(storedRooms) : [];

      const assetsWithRoomNames = parsedAssets.map((asset: Asset) => {
        const room = parsedRooms.find((r: Room) => r.id === asset.room_id);
        return { ...asset, room_name: room?.name };
      });

      setAssets(assetsWithRoomNames);
    }

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }
  }, []);

  const asset = useMemo(() => {
    return assets.find((a) => a.id === id);
  }, [assets, id]);

  const handleDelete = () => {
    if (!asset) return;
    const updated = assets.filter((a) => a.id !== asset.id);
    window.localStorage.setItem('homeBible.assets', JSON.stringify(updated));
    router.push('/assets');
  };

  if (!asset) {
    return (
      <>
        <PageHeader title="Asset not found" />
        <Card>
          <p style={{ color: '#6b7280' }}>
            This asset may not exist yet, or your local setup data was cleared.
          </p>
          <Link href="/assets">
            <Button type="button">Back to assets</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={asset.name}
        description={formatEnumLabel(asset.asset_type)}
      />

      <div style={{ display: 'grid', gap: 24 }}>
        {/* Summary Card */}
        <Card>
          <h2 style={{ marginTop: 0 }}>Asset Information</h2>

          <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: '#4b5563' }}>
            <div>
              <strong>Type:</strong> {formatEnumLabel(asset.asset_type)}
            </div>

            {asset.room_name && (
              <div>
                <strong>Location:</strong> {asset.room_name}
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
        {(asset.warranty_length_months || asset.warranty_expires_at) && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Warranty</h2>

            <div style={{ display: 'grid', gap: 12, fontSize: '0.875rem', color: '#4b5563' }}>
              {asset.warranty_length_months && (
                <div>
                  <strong>Coverage:</strong> {asset.warranty_length_months} months
                </div>
              )}

              {asset.warranty_expires_at && (
                <div>
                  <strong>Expires:</strong> {asset.warranty_expires_at}
                </div>
              )}
            </div>
          </Card>
        )}

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

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/assets">
            <Button type="button">Back to assets</Button>
          </Link>

          <button
            onClick={handleDelete}
            style={{
              padding: '10px 16px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Delete Asset
          </button>
        </div>
      </div>
    </>
  );
}
