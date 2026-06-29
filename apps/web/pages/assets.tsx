import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ASSET_TYPES, formatEnumLabel } from '@home-bible/shared';
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
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'purchase_date' | 'warranty'>('name');

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

  const roomOptions = useMemo(
    () => Array.from(rooms.entries()).map(([id, name]) => ({ id, name })),
    [rooms]
  );

  const filteredAssets = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return assets
      .filter((asset) => {
        const haystack = [
          asset.name,
          asset.brand,
          asset.model,
          asset.retailer
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = !searchTerm || haystack.includes(searchTerm);
        const matchesCategory = !categoryFilter || asset.asset_type === categoryFilter;
        const matchesRoom = !roomFilter || asset.room_id === roomFilter;

        return matchesSearch && matchesCategory && matchesRoom;
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'category') {
          const typeCompare = a.asset_type.localeCompare(b.asset_type);
          return typeCompare || a.name.localeCompare(b.name);
        }

        if (sortBy === 'purchase_date') {
          const aDate = a.purchase_date ? new Date(a.purchase_date).getTime() : 0;
          const bDate = b.purchase_date ? new Date(b.purchase_date).getTime() : 0;
          return bDate - aDate || a.name.localeCompare(b.name);
        }

        if (sortBy === 'warranty') {
          const aDate = a.warranty_expires_at ? new Date(a.warranty_expires_at).getTime() : Number.POSITIVE_INFINITY;
          const bDate = b.warranty_expires_at ? new Date(b.warranty_expires_at).getTime() : Number.POSITIVE_INFINITY;
          return aDate - bDate || a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
      });
  }, [assets, search, categoryFilter, roomFilter, sortBy]);

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
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Assets ({filteredAssets.length})</h2>
            <Link href="/add-asset">
              <Button type="button">Add asset</Button>
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, brand, model, retailer"
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">All categories</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>{formatEnumLabel(type)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Room</span>
              <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">All rooms</option>
                {roomOptions.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'name' | 'category' | 'purchase_date' | 'warranty')} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="purchase_date">Purchase date</option>
                <option value="warranty">Warranty expiration</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Loading assets...</p>
          ) : error ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>{error}</p>
          ) : dataMode === 'supabase' && context && !context.property ? (
            <EmptyState
              title="No property found"
              description="Create a property before adding assets."
            />
          ) : assets.length === 0 ? (
            <EmptyState
              title="No assets yet"
              description="Start tracking appliances, smart devices, tools, and other home items."
            />
          ) : filteredAssets.length === 0 ? (
            <EmptyState
              title="No assets match"
              description="Adjust the search or filters to see more assets."
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredAssets.map((asset) => {
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
        <div>
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
