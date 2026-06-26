import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel, ASSET_TYPES } from '@home-bible/shared';
import { PageHeader, Card, Button, EmptyState, UtilityBadge } from '@home-bible/ui';

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
};

type Room = {
  id: string;
  name: string;
};

export default function AssetsPage() {
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

  const handleDelete = (id: string) => {
    const updated = assets.filter((a) => a.id !== id);
    setAssets(updated);
    window.localStorage.setItem('homeBible.assets', JSON.stringify(updated));
  };

  if (assets.length === 0) {
    return (
      <>
        <PageHeader
          title="Assets"
          description="Appliances, accessories, smart devices, tools, and more"
        />
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <h2>No assets yet</h2>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>
              Start tracking your home items by adding your first asset.
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
        title="Assets"
        description="Appliances, accessories, smart devices, tools, and more"
      />

      <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/add-asset">
          <Button type="button">Add asset</Button>
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {assets.map((asset) => (
          <Card key={asset.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0' }}>{asset.name}</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <UtilityBadge label={formatEnumLabel(asset.asset_type)} />
                  {asset.room_name && <UtilityBadge label={asset.room_name} />}
                  {asset.brand && <UtilityBadge label={asset.brand} />}
                </div>

                <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
                  {asset.model && (
                    <div>
                      <strong>Model:</strong> {asset.model}
                    </div>
                  )}
                  {asset.serial_number && (
                    <div>
                      <strong>Serial:</strong> {asset.serial_number}
                    </div>
                  )}
                  {asset.purchase_date && (
                    <div>
                      <strong>Purchased:</strong> {asset.purchase_date}
                    </div>
                  )}
                  {asset.purchase_price && (
                    <div>
                      <strong>Price:</strong> ${asset.purchase_price}
                    </div>
                  )}
                  {asset.retailer && (
                    <div>
                      <strong>From:</strong> {asset.retailer}
                    </div>
                  )}
                  {asset.warranty_expires_at && (
                    <div>
                      <strong>Warranty expires:</strong> {asset.warranty_expires_at}
                    </div>
                  )}
                  {asset.notes && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Notes:</strong> {asset.notes}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href={`/assets/${asset.id}`}>
                  <Button type="button">View</Button>
                </Link>
                <button
                  onClick={() => handleDelete(asset.id)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
