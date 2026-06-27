import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getFloorsForProperty, getRoomsForProperty } from '../lib/rooms';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

function getWarrantyStatus(asset: AssetRow): 'active' | 'expiring_soon' | 'expired' | 'unknown' {
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
  const [floorCount, setFloorCount] = useState(0);
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
          const [floors, remoteRooms] = await Promise.all([
            getFloorsForProperty(utilityContext.property.id),
            getRoomsForProperty(utilityContext.property.id)
          ]);

          if (!isMounted) {
            return;
          }

          setFloorCount(floors.length);
          setRooms(
            remoteRooms.map((room) => ({
              id: room.id,
              name: room.name,
              room_type: room.room_type,
              floor_name: room.floor_name
            }))
          );
        } else {
          setFloorCount(0);
          setRooms([]);
        }
      } else {
        const demoProperty = getDemoActiveProperty();
        const demoRooms = getDemoRooms();

        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(demoRooms);
        setFloorCount(Array.from(new Set(demoRooms.map((room) => room.floor_name))).length);
      }

    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const floors = floorCount || Array.from(new Set(rooms.map((room) => room.floor_name))).length;

  const topAssetCategories = useMemo(() => {
    const counts = assets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.asset_type] = (acc[asset.asset_type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [assets]);

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
      completed: reminders.filter((reminder) => reminder.status === 'completed').length,
      dismissed: reminders.filter((reminder) => reminder.status === 'dismissed').length
    }),
    [reminders]
  );

  const upcomingReminders = useMemo(
    () =>
      reminders
        .filter((reminder) => reminder.status === 'open')
        .slice()
        .sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
          return aDue - bDue;
        })
        .slice(0, 4),
    [reminders]
  );

  const recentServiceRecords = useMemo(
    () =>
      serviceRecords
        .slice()
        .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())
        .slice(0, 4),
    [serviceRecords]
  );

  const openIssueCount = useMemo(
    () => issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').length,
    [issues]
  );

  const highUrgentIssueCount = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (issue.severity === 'high' || issue.severity === 'urgent') &&
          issue.status !== 'resolved' &&
          issue.status !== 'dismissed'
      ).length,
    [issues]
  );

  const activeTrendFlagCount = useMemo(
    () => trendFlags.filter((flag) => flag.status === 'active').length,
    [trendFlags]
  );

  const openRepairCount = useMemo(
    () => repairs.filter((repair) => repair.status === 'open').length,
    [repairs]
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
              <UtilityBadge label={`${floors} floor${floors === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${utilities.length} utilit${utilities.length === 1 ? 'y' : 'ies'}`} />
              <UtilityBadge label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${openRepairCount} open repair${openRepairCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${serviceRecords.length} service record${serviceRecords.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${openIssueCount} open issue${openIssueCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${highUrgentIssueCount} high or urgent issue${highUrgentIssueCount === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${activeTrendFlagCount} active trend flag${activeTrendFlagCount === 1 ? '' : 's'}`} />
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

            {topAssetCategories.length > 0 ? (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topAssetCategories.map(([assetType, count]) => (
                  <UtilityBadge key={assetType} label={`${formatEnumLabel(assetType)}: ${count}`} />
                ))}
              </div>
            ) : null}

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
              <Link href="/repairs">
                <Button type="button">View repairs</Button>
              </Link>
              <Link href="/issues">
                <Button type="button">View issues</Button>
              </Link>
              <Link href="/settings">
                <Button type="button">Settings</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Service records</h2>
            {recentServiceRecords.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No service records yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {recentServiceRecords.map((record) => (
                  <div
                    key={record.id}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#fff'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{record.service_title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {record.service_date} • {formatEnumLabel(record.service_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Trend flags</h2>
            {trendFlags.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No trend flags currently.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {trendFlags.slice(0, 6).map((flag) => (
                  <div key={flag.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>{flag.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {flag.description || `${formatEnumLabel(flag.flag_type)} • ${formatEnumLabel(flag.status)} • ${formatEnumLabel(flag.severity)}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <UtilityBadge label={`${reminderSummary.completed} completed`} />
              <UtilityBadge label={`${reminderSummary.dismissed} dismissed`} />
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
                      {reminder.due_date || 'No due date'} • {formatEnumLabel(reminder.reminder_type)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms</h2>
            {!hasProperty ? (
              <div>
                <p style={{ color: '#6b7280' }}>No property found yet.</p>
                <Link href="/create-property">
                  <Button type="button">Create property</Button>
                </Link>
              </div>
            ) : rooms.length === 0 ? (
              <div>
                <p style={{ color: '#6b7280' }}>No rooms added yet.</p>
                <Link href="/add-rooms">
                  <Button type="button">Add rooms</Button>
                </Link>
              </div>
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
