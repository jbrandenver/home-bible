import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const storedRooms = window.localStorage.getItem('homeBible.rooms');

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }
  }, []);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === id);
  }, [rooms, id]);

  if (!room) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#f8f5ef',
          padding: '48px 20px'
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Card>
            <h1 style={{ marginTop: 0 }}>Room not found</h1>
            <p style={{ color: '#6b7280' }}>
              This room may not exist yet, or your local setup data was cleared.
            </p>
            <Link href="/home-map">
              <Button type="button">Back to home map</Button>
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f5ef',
        padding: '48px 20px'
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
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
              <UtilityBadge label="Utilities next" />
              <UtilityBadge label="Assets next" />
              <UtilityBadge label="Receipts next" />
            </div>
          </Card>

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
            <Link href="/settings">
              <Button type="button">Settings</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
