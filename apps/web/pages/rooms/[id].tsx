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

type Utility = {
  id: string;
  utility_type: string;
  name: string;
  room_id?: string;
  location_notes?: string;
  emergency_notes?: string;
};

type Asset = {
  id: string;
  asset_type: string;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  room_id?: string;
  warranty_expires_at?: string;
  notes?: string;
};

type Reminder = {
  id: string;
  title: string;
  reminder_type: string;
  due_date: string;
  linked_type?: string | null;
  linked_id?: string | null;
  status: string;
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    const storedReminders = window.localStorage.getItem('homeBible.reminders');

    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }

    if (storedUtilities) {
      setUtilities(JSON.parse(storedUtilities));
    }

    if (storedAssets) {
      setAssets(JSON.parse(storedAssets));
    }

    if (storedReminders) {
      setReminders(JSON.parse(storedReminders));
    }
  }, []);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === id);
  }, [rooms, id]);

  const roomUtilities = useMemo(() => {
    return utilities.filter((u) => u.room_id === id);
  }, [utilities, id]);

  const roomAssets = useMemo(() => {
    return assets.filter((a) => a.room_id === id);
  }, [assets, id]);

  const roomReminders = useMemo(
    () => reminders.filter((reminder) => reminder.linked_type === 'room' && reminder.linked_id === id),
    [reminders, id]
  );

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
            <UtilityBadge label={`${roomAssets.length} asset${roomAssets.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomReminders.length} reminder${roomReminders.length === 1 ? '' : 's'}`} />
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

        {roomAssets.length > 0 && (
          <Card>
            <h2 style={{ marginTop: 0 }}>Assets in this room</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {roomAssets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{asset.name}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 4 }}>
                        <UtilityBadge label={formatEnumLabel(asset.asset_type)} />
                      </div>
                      {asset.brand && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Brand:</strong> {asset.brand}
                        </div>
                      )}
                      {asset.model && (
                        <div style={{ fontSize: '0.875rem', marginBottom: 4 }}>
                          <strong>Model:</strong> {asset.model}
                        </div>
                      )}
                      {asset.warranty_expires_at && (
                        <div style={{ fontSize: '0.875rem', color: '#d97706', marginBottom: 4 }}>
                          <strong>Warranty expires:</strong> {asset.warranty_expires_at}
                        </div>
                      )}
                    </div>
                    <Link href={`/assets/${asset.id}`}>
                      <Button type="button">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 style={{ marginTop: 0 }}>Reminders for this room</h2>
          {roomReminders.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No reminders linked to this room yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                    {reminder.due_date} • {formatEnumLabel(reminder.status)} •{' '}
                    {formatEnumLabel(reminder.reminder_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/reminders">
              <Button type="button">Manage reminders</Button>
            </Link>
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
          <Link href="/utilities">
            <Button type="button">All utilities</Button>
          </Link>
          <Link href="/reminders">
            <Button type="button">All reminders</Button>
          </Link>
          <Link href="/settings">
            <Button type="button">Settings</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
