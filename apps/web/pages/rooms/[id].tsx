import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge, EmptyState } from '@home-bible/ui';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

type Utility = {
  id: string;
  utility_type: string;
  name: string;
  room_id?: string;
  location_notes?: string;
  emergency_notes?: string;
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);

  useEffect(() => {
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }

    if (storedUtilities) {
      setUtilities(JSON.parse(storedUtilities));
    }
  }, []);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === id);
  }, [rooms, id]);

  const roomUtilities = useMemo(() => {
    return utilities.filter((u) => u.room_id === id);
  }, [utilities, id]);

  if (!room) {
    return (
      <>
        <PageHeader title="Room not found" />
        <Card>
          <p style={{ color: '#6b7280' }}>
            This room may not exist yet, or your local setup data was cleared.
          </p>
          <Link href="/home-map">
            <Button type="button">Back to home map</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={room.name}
        description={`${formatEnumLabel(room.room_type)} on ${room.floor_name}`}
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Room snapshot</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <UtilityBadge label={formatEnumLabel(room.room_type)} />
            <UtilityBadge label={room.floor_name} />
            <UtilityBadge label={`${roomUtilities.length} utilit${roomUtilities.length === 1 ? 'y' : 'ies'}`} />
            <UtilityBadge label="Assets next" />
            <UtilityBadge label="Receipts next" />
          </div>
        </Card>

        {roomUtilities.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Utilities in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomUtilities.map((utility) => (
                <div
                  key={utility.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{utility.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 4 }}>
                    <UtilityBadge label={formatEnumLabel(utility.utility_type)} />
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
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>What will live here</h2>
          <p style={{ color: '#4b5563' }}>
            This room will store utilities, appliances, accessories, smart devices, tools, receipts, warranties, repairs, photos, and notes.
          </p>
        </Card>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/home-map">
            <Button type="button">Back to home map</Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
          <Link href="/utilities">
            <Button type="button">All utilities</Button>
          </Link>
          <Link href="/settings">
            <Button type="button">Settings</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
