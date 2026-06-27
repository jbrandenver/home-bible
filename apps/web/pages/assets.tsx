import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, EmptyState, UtilityBadge } from '@home-bible/ui';
import {
  deleteAssetForContext,
  getAssetDataContext,
  getAssetsForContext,
  type AssetDataContext,
  type AssetDataMode,
  type AssetRow
} from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';

type Room = {
  id: string;
  name: string;
};

export default function AssetsPage() {
  const [context, setContext] = useState<AssetDataContext | null>(null);
  const [dataMode, setDataMode] = useState<AssetDataMode>('demo');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const nextContext = await getAssetDataContext();
        const [nextAssets, roomList] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getAssetsForContext(nextContext),
                getRoomsForProperty(nextContext.property.id)
              ])
            : [await getAssetsForContext(nextContext), getDemoRooms()];

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setAssets(nextAssets);
        setRooms(new Map(roomList.map((room: Room) => [room.id, room.name])));
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load assets.');
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

  const handleDelete = async (id: string) => {
    if (!context) {
      return;
    }

    setDeletingId(id);
    setError('');

    try {
      await deleteAssetForContext(context, id);
      setAssets((currentAssets) => currentAssets.filter((asset) => asset.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete asset.');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoomName = (roomId?: string | null) => {
    if (!roomId) return null;
    return rooms.get(roomId) || 'Unknown room';
  };

  return (
    <>
      <PageHeader
        title="Assets"
        description="Appliances, accessories, smart devices, tools, and more"
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: assets are loaded from Supabase.'
              : 'Demo mode: assets are stored in localStorage only.'}
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Assets ({assets.length})</h2>
            <Link href="/add-asset">
              <Button type="button">Add asset</Button>
            </Link>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Loading assets...</p>
          ) : error ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>{error}</p>
          ) : dataMode === 'supabase' && context && !context.property ? (
            <EmptyState
              title="No property found"
              description="Create a property before adding Supabase assets."
            />
          ) : assets.length === 0 ? (
            <EmptyState
              title="No assets yet"
              description="Start tracking appliances, smart devices, tools, and other home items."
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {assets.map((asset) => {
                const roomName = getRoomName(asset.room_id);

                return (
                  <div
                    key={asset.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 16,
                      alignItems: 'start'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: '0 0 8px 0' }}>{asset.name}</h3>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        <UtilityBadge label={formatEnumLabel(asset.asset_type)} />
                        {roomName && <UtilityBadge label={roomName} />}
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
                            <strong>Price:</strong> ${asset.purchase_price.toFixed(2)}
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
                        disabled={deletingId === asset.id}
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.875rem',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          cursor: deletingId === asset.id ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                          opacity: deletingId === asset.id ? 0.7 : 1
                        }}
                      >
                        {deletingId === asset.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
