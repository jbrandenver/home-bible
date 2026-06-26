import Link from 'next/link';
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
};

type Asset = {
  id: string;
  asset_type: string;
  name: string;
  room_id?: string;
  purchase_date?: string | null;
  warranty_length_months?: number | null;
  warranty_expires_at?: string | null;
};

type Reminder = {
  id: string;
  title: string;
  due_date: string;
  status: 'open' | 'done' | 'snoozed' | string;
  linked_type?: string | null;
  reminder_type: string;
};

function getWarrantyStatus(asset: Asset): 'active' | 'expiring_soon' | 'expired' | 'unknown' {
  let expirationDate: Date | null = null;

  if (asset.warranty_expires_at) {
    expirationDate = new Date(asset.warranty_expires_at);
  } else if (asset.purchase_date && asset.warranty_length_months) {
    const purchaseDate = new Date(asset.purchase_date);
    expirationDate = new Date(purchaseDate);
    expirationDate.setMonth(expirationDate.getMonth() + asset.warranty_length_months);
  }

  if (!expirationDate || Number.isNaN(expirationDate.getTime())) {
    return 'unknown';
  }

  const daysRemaining = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return 'expired';
  }

  if (daysRemaining <= 30) {
    return 'expiring_soon';
  }

  return 'active';
};

export default function DashboardPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const storedProperty = window.localStorage.getItem('homeBible.activeProperty');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');
    const storedAssets = window.localStorage.getItem('homeBible.assets');
    const storedReminders = window.localStorage.getItem('homeBible.reminders');

    if (storedProperty) {
      const property = JSON.parse(storedProperty);
      setPropertyNickname(property.nickname || 'Your property');
    }

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

  const floors = Array.from(new Set(rooms.map((room) => room.floor_name)));

  const warrantySummary = useMemo(
    () => ({
      active: assets.filter((asset) => getWarrantyStatus(asset) === 'active').length,
      expiringSoon: assets.filter((asset) => getWarrantyStatus(asset) === 'expiring_soon').length,
      expired: assets.filter((asset) => getWarrantyStatus(asset) === 'expired').length,
      unknown: assets.filter((asset) => getWarrantyStatus(asset) === 'unknown').length
    }),
    [assets]
  );

  const reminderSummary = useMemo(
    () => ({
      open: reminders.filter((reminder) => reminder.status === 'open').length,
      snoozed: reminders.filter((reminder) => reminder.status === 'snoozed').length,
      done: reminders.filter((reminder) => reminder.status === 'done').length
    }),
    [reminders]
  );

  const upcomingReminders = useMemo(
    () =>
      reminders
        .filter((reminder) => reminder.status !== 'done')
        .slice()
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 4),
    [reminders]
  );

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
              <UtilityBadge label={`${utilities.length} utilit${utilities.length === 1 ? 'y' : 'ies'}`} />
              <UtilityBadge label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/home-map">
                <Button type="button">View home map</Button>
              </Link>
              <Link href="/utilities">
                <Button type="button">View utilities</Button>
              </Link>
              <Link href="/assets">
                <Button type="button">View assets</Button>
              </Link>
              <Link href="/warranties">
                <Button type="button">View warranties</Button>
              </Link>
              <Link href="/reminders">
                <Button type="button">View reminders</Button>
              </Link>
              <Link href="/settings">
                <Button type="button">Settings</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Warranty summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${warrantySummary.active} active`} />
              <UtilityBadge label={`${warrantySummary.expiringSoon} expiring soon`} />
              <UtilityBadge label={`${warrantySummary.expired} expired`} />
              <UtilityBadge label={`${warrantySummary.unknown} unknown`} />
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Reminder summary</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <UtilityBadge label={`${reminderSummary.open} open`} />
              <UtilityBadge label={`${reminderSummary.snoozed} snoozed`} />
              <UtilityBadge label={`${reminderSummary.done} done`} />
            </div>

            {upcomingReminders.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No reminders yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{reminder.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {reminder.due_date} • {formatEnumLabel(reminder.reminder_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
