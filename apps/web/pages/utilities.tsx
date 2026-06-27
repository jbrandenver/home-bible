import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, EmptyState, UtilityBadge } from '@home-bible/ui';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';
import {
  deleteUtilityForContext,
  getUtilitiesForContext,
  getUtilityDataContext,
  type UtilityDataContext,
  type UtilityDataMode,
  type UtilityRow
} from '../lib/utilities';

export default function UtilitiesPage() {
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
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
        const nextContext = await getUtilityDataContext();
        const [nextUtilities, roomList] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getUtilitiesForContext(nextContext),
                getRoomsForProperty(nextContext.property.id)
              ])
            : [await getUtilitiesForContext(nextContext), getDemoRooms()];

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setUtilities(nextUtilities);
        setRooms(new Map(roomList.map((room) => [room.id, room.name])));
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load utilities.');
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
      await deleteUtilityForContext(context, id);
      setUtilities((currentUtilities) => currentUtilities.filter((utility) => utility.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete utility.');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoomName = (roomId?: string | null) => {
    if (!roomId) return 'Not assigned';
    return rooms.get(roomId) || 'Unknown room';
  };

  return (
    <>
      <PageHeader
        title="Utilities"
        description="Key locations and emergency information for critical systems."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: utilities are loaded from Supabase.'
              : 'Demo mode: utilities are stored in localStorage only.'}
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Utilities ({utilities.length})</h2>
            <Link href="/add-utility">
              <Button>Add Utility</Button>
            </Link>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Loading utilities...</p>
          ) : error ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>{error}</p>
          ) : dataMode === 'supabase' && context && !context.property ? (
            <EmptyState
              title="No property found"
              description="Create a property before adding Supabase utilities."
            />
          ) : utilities.length === 0 ? (
            <EmptyState
              title="No utilities yet"
              description="Add key utility locations like water shutoff, electrical panel, and HVAC to get started."
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {utilities.map((utility) => (
                <div
                  key={utility.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'start'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{utility.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 8 }}>
                      <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
                      <span style={{ marginLeft: 8 }}>•</span>
                      <span style={{ marginLeft: 8 }}>{getRoomName(utility.room_id)}</span>
                    </div>
                    {utility.location_notes && (
                      <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                        <strong>Location:</strong> {utility.location_notes}
                      </div>
                    )}
                    {utility.emergency_notes && (
                      <div style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                        <strong>Emergency:</strong> {utility.emergency_notes}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(utility.id)}
                    disabled={deletingId === utility.id}
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                      opacity: deletingId === utility.id ? 0.7 : 1
                    }}
                  >
                    {deletingId === utility.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
