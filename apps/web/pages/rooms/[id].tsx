import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { detectTrendFlags, trendFlagsForEntity, type IssueRecord, type ServiceRecord as TrendServiceRecord } from '../../components/trendFlags';
import { getDemoCollection, getDemoRooms } from '../../lib/demoStorage';
import { getRoomById } from '../../lib/rooms';
import { getUtilitiesForRoom, getUtilityDataContext, type UtilityRow } from '../../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
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

type ServiceRecord = TrendServiceRecord & {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  follow_up_date?: string | null;
  follow_up_needed?: boolean;
};

type Issue = IssueRecord & {
  id: string;
  title: string;
  issue_type: string;
  date_found: string;
};

export default function RoomDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const roomId = typeof id === 'string' ? id : '';

  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [utilityError, setUtilityError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!roomId) {
        return;
      }

      setUtilityError('');

      const utilityContext = await getUtilityDataContext();
      let nextUtilities: UtilityRow[] = [];

      try {
        nextUtilities = await getUtilitiesForRoom(utilityContext, roomId);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load room utilities.');
        }
      }

      if (utilityContext.mode === 'supabase') {
        const remoteRoom = await getRoomById(roomId);

        if (!isMounted) {
          return;
        }

        if (remoteRoom) {
          setDataMode('supabase');
          setRooms([
            {
              id: remoteRoom.id,
              name: remoteRoom.name,
              room_type: remoteRoom.room_type,
              floor_name: remoteRoom.floor_name
            }
          ]);
        } else {
          setDataMode('supabase');
          setRooms([]);
        }
      } else {
        if (!isMounted) {
          return;
        }
        setDataMode('demo');
        setRooms(getDemoRooms());
      }

      setUtilities(nextUtilities);
      setAssets(getDemoCollection<Asset>('homeBible.assets'));
      setReminders(getDemoCollection<Reminder>('homeBible.reminders'));
      setServiceRecords(getDemoCollection<ServiceRecord>('homeBible.serviceRecords'));
      setIssues(getDemoCollection<Issue>('homeBible.issues'));
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const room = useMemo(() => {
    return rooms.find((currentRoom) => currentRoom.id === roomId);
  }, [rooms, roomId]);

  const roomUtilities = useMemo(() => {
    return utilities.filter((u) => u.room_id === roomId);
  }, [utilities, roomId]);

  const roomAssets = useMemo(() => {
    return assets.filter((a) => a.room_id === roomId);
  }, [assets, roomId]);

  const roomReminders = useMemo(
    () => reminders.filter((reminder) => reminder.linked_type === 'room' && reminder.linked_id === roomId),
    [reminders, roomId]
  );

  const utilityIdsInRoom = useMemo(
    () => new Set(roomUtilities.map((utility) => utility.id)),
    [roomUtilities]
  );

  const roomServiceRecords = useMemo(
    () =>
      serviceRecords.filter(
        (record) => record.room_id === roomId || (!!record.utility_id && utilityIdsInRoom.has(record.utility_id))
      ),
    [serviceRecords, roomId, utilityIdsInRoom]
  );

  const roomIssues = useMemo(
    () =>
      issues.filter(
        (issue) => issue.room_id === roomId || (!!issue.utility_id && utilityIdsInRoom.has(issue.utility_id))
      ),
    [issues, roomId, utilityIdsInRoom]
  );

  const trendFlags = useMemo(() => detectTrendFlags(serviceRecords, issues), [serviceRecords, issues]);
  const roomTrendFlags = useMemo(() => trendFlagsForEntity(trendFlags, 'room', roomId), [trendFlags, roomId]);

  if (!room) {
    return (
      <>
        <PageHeader title="Room not found" />
        <Card>
          <p style={{ color: '#6b7280' }}>
            This room may not exist yet, or setup data was cleared.
          </p>
          <p style={{ color: '#6b7280', marginTop: 8 }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode is active. If this room was removed, it will no longer appear.'
              : 'Demo mode is active. Add rooms from the onboarding flow to continue.'}
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
            <UtilityBadge label={`${roomServiceRecords.length} service record${roomServiceRecords.length === 1 ? '' : 's'}`} />
            <UtilityBadge label={`${roomIssues.length} issue${roomIssues.length === 1 ? '' : 's'}`} />
          </div>
          <p style={{ marginTop: 12, marginBottom: 0, color: '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Signed-in mode: utilities for this room are loaded from Supabase.'
              : 'Demo mode: utilities for this room are loaded from localStorage.'}
          </p>
          {utilityError ? (
            <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
              {utilityError}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Trend flags</h2>
          {roomTrendFlags.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No room-level trend flags currently.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomTrendFlags.map((flag) => (
                <div key={flag.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{flag.label}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{flag.details}</div>
                </div>
              ))}
            </div>
          )}
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
          <h2 style={{ marginTop: 0 }}>Service records for this room</h2>
          {roomServiceRecords.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No service records linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomServiceRecords
                .slice()
                .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
                .map((record) => (
                  <div key={record.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{record.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                    {record.follow_up_needed && (
                      <div style={{ color: '#92400e', fontSize: '0.875rem' }}>
                        Follow-up: {record.follow_up_date || 'Needed'}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/repairs">
              <Button type="button">Manage repairs</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Issues for this room</h2>
          {roomIssues.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No issues linked to this room.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {roomIssues
                .slice()
                .sort((a, b) => new Date(b.date_found || 0).getTime() - new Date(a.date_found || 0).getTime())
                .map((issue) => (
                  <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{issue.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {issue.date_found} • {formatEnumLabel(issue.issue_type)} • {formatEnumLabel(issue.status)}
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/issues">
              <Button type="button">Manage issues</Button>
            </Link>
          </div>
        </Card>

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
          <Link href="/repairs">
            <Button type="button">All repairs</Button>
          </Link>
          <Link href="/issues">
            <Button type="button">All issues</Button>
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
