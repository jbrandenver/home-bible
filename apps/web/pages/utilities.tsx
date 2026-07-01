import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { formatEnumLabel, UTILITY_TYPES } from '@home-bible/shared';
import { PageHeader, Card, EmptyState, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';
import { getDemoRooms } from '../lib/demoStorage';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
import { formatRoomLocation } from '../lib/roomLabels';
import { getServiceRecordDataContext, getServiceRecordsForContext, type ServiceRecordRow } from '../lib/serviceRecords';
import { getTrendFlagDataContext, getTrendFlagsForContext, type TrendFlagRow } from '../lib/trendFlags';
import {
  deleteUtilityForContext,
  getUtilitiesForContext,
  getUtilityDataContext,
  type UtilityDataContext,
  type UtilityDataMode,
  type UtilityRow
} from '../lib/utilities';

type UtilityTypeFilter = '' | (typeof UTILITY_TYPES)[number] | 'hvac' | 'router_modem' | 'safety_device';

const UTILITY_FILTER_GROUPS: Record<string, (typeof UTILITY_TYPES)[number][]> = {
  hvac: ['hvac_unit', 'furnace', 'air_conditioner'],
  router_modem: ['internet_modem', 'router'],
  safety_device: ['smoke_detector', 'carbon_monoxide_detector']
};

const utilityTypeFilterOptions: { value: UtilityTypeFilter; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'hvac', label: 'HVAC systems' },
  { value: 'router_modem', label: 'Router / modem' },
  { value: 'safety_device', label: 'Smoke / CO devices' },
  ...UTILITY_TYPES.map((type) => ({ value: type, label: formatEnumLabel(type) }))
];

function normalizeUtilityTypeFilter(value: string | string[] | undefined): UtilityTypeFilter {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return '';
  }

  if (UTILITY_TYPES.includes(rawValue as (typeof UTILITY_TYPES)[number])) {
    return rawValue as (typeof UTILITY_TYPES)[number];
  }

  if (rawValue in UTILITY_FILTER_GROUPS) {
    return rawValue as UtilityTypeFilter;
  }

  return '';
}

function getUtilityTypeFilterValues(filter: UtilityTypeFilter) {
  if (!filter) {
    return [];
  }

  return UTILITY_FILTER_GROUPS[filter] || [filter as (typeof UTILITY_TYPES)[number]];
}

export default function UtilitiesPage() {
  const router = useRouter();
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecordRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [trendFlags, setTrendFlags] = useState<TrendFlagRow[]>([]);
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [repairError, setRepairError] = useState('');
  const [serviceRecordError, setServiceRecordError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [trendFlagError, setTrendFlagError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UtilityTypeFilter>('');
  const [roomFilter, setRoomFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'utility_type'>('name');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setReminderError('');
      setRepairError('');
      setServiceRecordError('');
      setIssueError('');
      setTrendFlagError('');

      try {
        const [nextContext, reminderContext, repairContext, serviceRecordContext, issueContext, trendFlagContext] = await Promise.all([
          getUtilityDataContext(),
          getReminderDataContext(),
          getRepairDataContext(),
          getServiceRecordDataContext(),
          getIssueDataContext(),
          getTrendFlagDataContext()
        ]);
        const [nextUtilities, roomList] =
          nextContext.mode === 'supabase' && nextContext.property
            ? await Promise.all([
                getUtilitiesForContext(nextContext),
                getRoomsForProperty(nextContext.property.id)
              ])
            : [await getUtilitiesForContext(nextContext), getDemoRooms()];
        let nextReminders: ReminderRow[] = [];
        let nextRepairs: RepairRow[] = [];
        let nextServiceRecords: ServiceRecordRow[] = [];
        let nextIssues: IssueRow[] = [];
        let nextTrendFlags: TrendFlagRow[] = [];

        try {
          nextReminders = await getRemindersForContext(reminderContext);
        } catch (loadError) {
          if (isMounted) {
            setReminderError(loadError instanceof Error ? loadError.message : 'Failed to load utility reminders.');
          }
        }

        try {
          nextRepairs = await getRepairsForContext(repairContext);
        } catch (loadError) {
          if (isMounted) {
            setRepairError(loadError instanceof Error ? loadError.message : 'Failed to load utility repairs.');
          }
        }

        try {
          nextServiceRecords = await getServiceRecordsForContext(serviceRecordContext);
        } catch (loadError) {
          if (isMounted) {
            setServiceRecordError(loadError instanceof Error ? loadError.message : 'Failed to load utility service history.');
          }
        }

        try {
          nextIssues = await getIssuesForContext(issueContext);
        } catch (loadError) {
          if (isMounted) {
            setIssueError(loadError instanceof Error ? loadError.message : 'Failed to load utility issues.');
          }
        }

        try {
          nextTrendFlags = await getTrendFlagsForContext(trendFlagContext);
        } catch (loadError) {
          if (isMounted) {
            setTrendFlagError(loadError instanceof Error ? loadError.message : 'Failed to load utility trends.');
          }
        }

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setUtilities(nextUtilities);
        setReminders(nextReminders);
        setRepairs(nextRepairs);
        setServiceRecords(nextServiceRecords);
        setIssues(nextIssues);
        setTrendFlags(nextTrendFlags);
        setRooms(new Map(roomList.map((room) => [room.id, formatRoomLocation(room)])));
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

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    setTypeFilter(normalizeUtilityTypeFilter(router.query.type));
  }, [router.isReady, router.query.type]);

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

  const getReminderCount = (utilityId: string) =>
    reminders.filter(
      (reminder) =>
        reminder.utility_id === utilityId ||
        (reminder.linked_type === 'utility' && reminder.linked_id === utilityId)
    ).length;

  const getRepairCount = (utilityId: string) =>
    repairs.filter((repair) => repair.utility_id === utilityId).length;

  const getServiceRecordCount = (utilityId: string) =>
    serviceRecords.filter((record) => record.utility_id === utilityId).length;

  const getIssueCount = (utilityId: string) =>
    issues.filter(
      (issue) =>
        issue.utility_id === utilityId &&
        issue.status !== 'resolved' &&
        issue.status !== 'dismissed'
    ).length;

  const getTrendFlagCount = (utilityId: string) =>
    trendFlags.filter((flag) => flag.utility_id === utilityId && flag.status === 'active').length;

  const roomOptions = useMemo(
    () => Array.from(rooms.entries()).map(([id, name]) => ({ id, name })),
    [rooms]
  );

  const filteredUtilities = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const typeFilterValues = getUtilityTypeFilterValues(typeFilter);

    return utilities
      .filter((utility) => {
        const matchesSearch = !searchTerm || utility.name.toLowerCase().includes(searchTerm);
        const matchesType = typeFilterValues.length === 0 || typeFilterValues.includes(utility.utility_type);
        const matchesRoom = !roomFilter || utility.room_id === roomFilter;

        return matchesSearch && matchesType && matchesRoom;
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'utility_type') {
          const typeCompare = a.utility_type.localeCompare(b.utility_type);
          return typeCompare || a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
      });
  }, [utilities, search, typeFilter, roomFilter, sortBy]);

  return (
    <>
      <PageHeader
        title="Utilities"
        description="Where the critical systems live."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
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

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Utilities ({filteredUtilities.length})</h2>
            <ActionLink href="/add-utility">Add utility</ActionLink>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Utility name"
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as UtilityTypeFilter)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                {utilityTypeFilterOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Room</span>
              <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">All rooms</option>
                {roomOptions.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'name' | 'utility_type')} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="name">Name</option>
                <option value="utility_type">Utility type</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Loading utilities...</p>
          ) : error ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>{error}</p>
          ) : dataMode === 'supabase' && context && !context.property ? (
            <div>
              <EmptyState
                title="Start your home record."
                description="Create a property before adding utilities."
              />
              <ActionLink href="/create-property" variant="secondary">Create property</ActionLink>
            </div>
          ) : utilities.length === 0 ? (
            <div>
              <EmptyState
                title="No utilities yet"
                description="Add the shut-offs and systems you'll want to find fast."
              />
              <ActionLink href="/add-utility" variant="secondary">Add utility</ActionLink>
            </div>
          ) : filteredUtilities.length === 0 ? (
            <EmptyState
              title="No utilities match"
              description="Adjust the search or filters to see more utility records."
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredUtilities.map((utility) => (
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
                      <span style={{ marginLeft: 8 }}>
                        <UtilityBadge label={`${getReminderCount(utility.id)} reminder${getReminderCount(utility.id) === 1 ? '' : 's'}`} />
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <UtilityBadge label={`${getRepairCount(utility.id)} repair${getRepairCount(utility.id) === 1 ? '' : 's'}`} />
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <UtilityBadge label={`${getServiceRecordCount(utility.id)} service${getServiceRecordCount(utility.id) === 1 ? '' : 's'}`} />
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <UtilityBadge label={`${getIssueCount(utility.id)} issue${getIssueCount(utility.id) === 1 ? '' : 's'}`} />
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <UtilityBadge label={`${getTrendFlagCount(utility.id)} trend${getTrendFlagCount(utility.id) === 1 ? '' : 's'}`} />
                      </span>
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
                  <div style={{ display: 'grid', gap: 8 }}>
                    <ActionLink href={`/utilities/${utility.id}`} variant="secondary">View</ActionLink>
                    <button
                      onClick={() => handleDelete(utility.id)}
                      disabled={deletingId === utility.id}
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        borderRadius: 4,
                        padding: '8px 10px',
                        cursor: deletingId === utility.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                        opacity: deletingId === utility.id ? 0.7 : 1
                      }}
                    >
                      {deletingId === utility.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </div>
    </>
  );
}
