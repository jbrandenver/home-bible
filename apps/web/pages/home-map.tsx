import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, FloorSection, RoomCard, UtilityBadge } from '@home-bible/ui';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function HomeMapPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [utilityError, setUtilityError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setUtilityError('');
      setAssetError('');
      setReminderError('');
      setRepairError('');
      setServiceRecordError('');
      setIssueError('');
      setTrendFlagError('');

      const [
        utilityContext,
        assetContext,
        reminderContext,
        repairContext,
        serviceRecordContext,
        issueContext,
        trendFlagContext
      ] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext(),
        getReminderDataContext(),
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getIssueDataContext(),
        getTrendFlagDataContext()
      ]);
      let nextUtilities: UtilityRow[] = [];
      let nextAssets: AssetRow[] = [];
      let nextReminders: ReminderRow[] = [];
      let nextRepairs: RepairRow[] = [];
      let nextServiceRecords: ServiceRecordRow[] = [];
      let nextIssues: IssueRow[] = [];
      let nextTrendFlags: TrendFlagRow[] = [];

      try {
        nextUtilities = await getUtilitiesForContext(utilityContext);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load utilities.');
        }
      }

      try {
        nextAssets = await getAssetsForContext(assetContext);
      } catch (loadError) {
        if (isMounted) {
          setAssetError(loadError instanceof Error ? loadError.message : 'Failed to load assets.');
        }
      }

      try {
        nextReminders = await getRemindersForContext(reminderContext);
      } catch (loadError) {
        if (isMounted) {
          setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load reminders.');
        }
      }

      try {
        nextRepairs = await getRepairsForContext(repairContext);
      } catch (loadError) {
        if (isMounted) {
          setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load repairs.');
        }
      }

      try {
        nextServiceRecords = await getServiceRecordsForContext(serviceRecordContext);
      } catch (loadError) {
        if (isMounted) {
          setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load service records.');
        }
      }

      try {
        nextIssues = await getIssuesForContext(issueContext);
      } catch (loadError) {
        if (isMounted) {
          setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load issues.');
        }
      }

      try {
        nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
      } catch (loadError) {
        if (isMounted) {
          setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load trend flags.');
        }
      }

      if (!isMounted) {
        return;
      }

      setDataMode(utilityContext.mode);
      setUtilities(nextUtilities);
      setAssets(nextAssets);
      setReminders(nextReminders);
      setRepairs(nextRepairs);
      setServiceRecords(nextServiceRecords);
      setIssues(nextIssues);
      setTrendFlags(nextTrendFlags);

      if (utilityContext.mode === 'supabase') {
        setHasProperty(Boolean(utilityContext.property));
        setPropertyNickname(utilityContext.property?.nickname || 'Your property');

        if (utilityContext.property) {
          const remoteRooms = await getRoomsForProperty(utilityContext.property.id);
          if (!isMounted) {
            return;
          }

          setRooms(
            remoteRooms.map((room) => ({
              id: room.id,
              name: room.name,
              room_type: room.room_type,
              floor_name: room.floor_name
            }))
          );
        } else {
          setRooms([]);
        }
      } else {
        const demoProperty = getDemoActiveProperty();
        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(getDemoRooms());
      }

    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const roomsByFloor = useMemo(() => {
    return rooms.reduce<Record<string, Room[]>>((acc, room) => {
      if (!acc[room.floor_name]) {
        acc[room.floor_name] = [];
      }

      acc[room.floor_name].push(room);
      return acc;
    }, {});
  }, [rooms]);

  const floorNames = Object.keys(roomsByFloor);

  const assetCountsByRoom = useMemo(() => {
    return assets.reduce<Record<string, number>>((acc, asset) => {
      if (!asset.room_id) {
        return acc;
      }

      acc[asset.room_id] = (acc[asset.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [assets]);

  const reminderCountsByRoom = useMemo(() => {
    return reminders.reduce<Record<string, number>>((acc, reminder) => {
      const roomId = reminder.room_id || (reminder.linked_type === 'room' ? reminder.linked_id : null);
      if (!roomId) {
        return acc;
      }

      acc[roomId] = (acc[roomId] || 0) + 1;
      return acc;
    }, {});
  }, [reminders]);

  const repairCountsByRoom = useMemo(() => {
    return repairs.reduce<Record<string, number>>((acc, repair) => {
      if (!repair.room_id) {
        return acc;
      }

      acc[repair.room_id] = (acc[repair.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [repairs]);

  const serviceRecordCountsByRoom = useMemo(() => {
    return serviceRecords.reduce<Record<string, number>>((acc, record) => {
      if (!record.room_id) {
        return acc;
      }

      acc[record.room_id] = (acc[record.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [serviceRecords]);

  const issueCountsByRoom = useMemo(() => {
    return issues.reduce<Record<string, number>>((acc, issue) => {
      if (!issue.room_id || issue.status === 'resolved' || issue.status === 'dismissed') {
        return acc;
      }

      acc[issue.room_id] = (acc[issue.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  const trendFlagCountsByRoom = useMemo(() => {
    return trendFlags.reduce<Record<string, number>>((acc, flag) => {
      if (!flag.room_id || flag.status !== 'active') {
        return acc;
      }

      acc[flag.room_id] = (acc[flag.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [trendFlags]);

  return (
    <>
      <PageHeader
        title={`${propertyNickname} home map`}
        description="A simple room-based map of your home. This is the foundation for utilities, appliances, accessories, tools, receipts, warranties, and repairs."
        />

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Map overview</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${floorNames.length} floor${floorNames.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${utilities.length} utilit${utilities.length === 1 ? 'y' : 'ies'}`} />
              <UtilityBadge label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${repairs.length} repair${repairs.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${serviceRecords.length} service record${serviceRecords.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length} open issue${issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${trendFlags.filter((flag) => flag.status === 'active').length} active trend flag${trendFlags.filter((flag) => flag.status === 'active').length === 1 ? '' : 's'}`} />
            </div>
            <p style={{ marginTop: 12, marginBottom: 0, color: '#6b7280' }}>
              {dataMode === 'supabase'
                ? 'Signed-in mode: property, floors, rooms, utilities, assets, reminders, repairs, service records, issues, and trend flags are loaded from Supabase.'
                : 'Demo mode: property, floors, rooms, utilities, assets, reminders, repairs, service records, issues, and trend flags are loaded from localStorage.'}
            </p>
            {utilityError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {utilityError}
              </p>
            ) : null}
            {assetError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {assetError}
              </p>
            ) : null}
            {reminderError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {reminderError}
              </p>
            ) : null}
            {repairError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {repairError}
              </p>
            ) : null}
            {serviceRecordError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {serviceRecordError}
              </p>
            ) : null}
            {issueError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {issueError}
              </p>
            ) : null}
            {trendFlagError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {trendFlagError}
              </p>
            ) : null}
          </Card>

          {!hasProperty ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>No property yet</h2>
              <p style={{ color: '#6b7280' }}>Create a property first to build your home map.</p>
              <Link href="/create-property">
                <Button type="button">Create property</Button>
              </Link>
            </Card>
          ) : rooms.length === 0 ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>No rooms yet</h2>
              <p style={{ color: '#6b7280' }}>
                Add rooms first so Home Bible can build your home map.
              </p>
              <Link href="/add-rooms">
                <Button type="button">Add rooms</Button>
              </Link>
            </Card>
          ) : (
            floorNames.map((floorName) => (
              <FloorSection key={floorName} title={floorName}>
                {roomsByFloor[floorName].map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <RoomCard
                      name={room.name}
                      type={`${formatEnumLabel(room.room_type)} • ${assetCountsByRoom[room.id] || 0} asset${assetCountsByRoom[room.id] === 1 ? '' : 's'} • ${repairCountsByRoom[room.id] || 0} repair${repairCountsByRoom[room.id] === 1 ? '' : 's'} • ${serviceRecordCountsByRoom[room.id] || 0} service${serviceRecordCountsByRoom[room.id] === 1 ? '' : 's'} • ${reminderCountsByRoom[room.id] || 0} reminder${reminderCountsByRoom[room.id] === 1 ? '' : 's'} • ${issueCountsByRoom[room.id] || 0} issue${issueCountsByRoom[room.id] === 1 ? '' : 's'} • ${trendFlagCountsByRoom[room.id] || 0} trend${trendFlagCountsByRoom[room.id] === 1 ? '' : 's'}`}
                    />
                  </Link>
                ))}
              </FloorSection>
            ))
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button type="button">Back to dashboard</Button>
            </Link>
            <Link href="/add-rooms">
              <Button type="button">Add more rooms</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }
