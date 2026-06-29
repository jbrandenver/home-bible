import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel, UTILITY_TYPES } from '@home-bible/shared';
import { PageHeader, Card, Button, EmptyState, UtilityBadge } from '@home-bible/ui';
import { getDemoRooms } from '../lib/demoStorage';
import { getIssueDataContext, getIssuesForContext, type IssueRow } from '../lib/issues';
import { getReminderDataContext, getRemindersForContext, type ReminderRow } from '../lib/reminders';
import { getRepairDataContext, getRepairsForContext, type RepairRow } from '../lib/repairs';
import { getRoomsForProperty } from '../lib/rooms';
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

export default function UtilitiesPage() {
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
  const [typeFilter, setTypeFilter] = useState('');
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
        setRooms(new Map(roomList.map((room) => [room.id, room.name])));
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

    return utilities
      .filter((utility) => {
        const matchesSearch = !searchTerm || utility.name.toLowerCase().includes(searchTerm);
        const matchesType = !typeFilter || utility.utility_type === typeFilter;
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
        description="Key locations and emergency information for critical systems."
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
            <Link href="/add-utility">
              <Button>Add Utility</Button>
            </Link>
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
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="">All types</option>
                {UTILITY_TYPES.map((type) => (
                  <option key={type} value={type}>{formatEnumLabel(type)}</option>
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
            <EmptyState
              title="No property found"
              description="Create a property before adding utilities."
            />
          ) : utilities.length === 0 ? (
            <EmptyState
              title="No utilities yet"
              description="Add key utility locations like water shutoff, electrical panel, and HVAC to get started."
            />
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
                    <Link href={`/utilities/${utility.id}`}>
                      <Button type="button">View</Button>
                    </Link>
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
          <Link href="/dashboard">
            <Button type="button">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
