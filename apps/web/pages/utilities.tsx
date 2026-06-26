import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel, UTILITY_TYPES } from '@home-bible/shared';
import { PageHeader, Card, Button, EmptyState, UtilityBadge } from '@home-bible/ui';

type Utility = {
  id: string;
  utility_type: string;
  name: string;
  room_id?: string;
  room_name?: string;
  location_notes?: string;
  emergency_notes?: string;
};

type Room = {
  id: string;
  name: string;
};

export default function UtilitiesPage() {
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');

    if (storedUtilities) {
      const parsed = JSON.parse(storedUtilities);
      setUtilities(Array.isArray(parsed) ? parsed : []);
    }

    if (storedRooms) {
      const roomList = JSON.parse(storedRooms) as Room[];
      const roomMap = new Map(roomList.map((r) => [r.id, r.name]));
      setRooms(roomMap);
    }
  }, []);

  const handleDelete = (id: string) => {
    const updated = utilities.filter((u) => u.id !== id);
    setUtilities(updated);
    window.localStorage.setItem('homeBible.utilities', JSON.stringify(updated));
  };

  const getRoomName = (roomId?: string) => {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Utilities ({utilities.length})</h2>
            <Link href="/add-utility">
              <Button>Add Utility</Button>
            </Link>
          </div>

          {utilities.length === 0 ? (
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
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Delete
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
