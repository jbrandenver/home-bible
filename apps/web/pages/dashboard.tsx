import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function DashboardPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const storedProperty = window.localStorage.getItem('homeBible.activeProperty');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');

    if (storedProperty) {
      const property = JSON.parse(storedProperty);
      setPropertyNickname(property.nickname || 'Your property');
    }

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }
  }, []);

  const floors = Array.from(new Set(rooms.map((room) => room.floor_name)));

  return (
    <>
      <PageHeader
        title={propertyNickname}
        description="Your home map is starting to take shape."
      />

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Home map summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${floors.length} floor${floors.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`} />
              <UtilityBadge label="Utilities next" />
              <UtilityBadge label="Assets next" />
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/home-map">
                <Button type="button">View home map</Button>
              </Link>
              <Link href="/settings">
                <Button type="button">Settings</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms</h2>
            {rooms.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No rooms added yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {rooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: 16,
                        background: '#fff'
                      }}
                    >
                      <strong>{room.name}</strong>
                      <div style={{ color: '#6b7280' }}>
                        {formatEnumLabel(room.room_type)} • {room.floor_name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </>
    );
  }
