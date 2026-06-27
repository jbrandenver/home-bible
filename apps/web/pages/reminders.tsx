import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatEnumLabel,
  REMINDER_FREQUENCIES,
  REMINDER_LINKED_TYPES,
  REMINDER_PRIORITIES,
  REMINDER_STATUSES,
  REMINDER_TYPES
} from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import {
  createReminderForContext,
  deleteReminderForContext,
  getReminderDataContext,
  getRemindersForContext,
  updateReminderStatusForContext,
  type ReminderDataContext,
  type ReminderDataMode,
  type ReminderFrequency,
  type ReminderLinkedType,
  type ReminderPriority,
  type ReminderRow,
  type ReminderStatus,
  type ReminderType
} from '../lib/reminders';
import { getRoomsForProperty } from '../lib/rooms';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type LinkTypeOption = '' | ReminderLinkedType;
type PropertyOption = { id: string; nickname: string };
type RoomOption = { id: string; name: string };

function formatDateLabel(value: string | null) {
  return value || 'No due date';
}

export default function RemindersPage() {
  const [context, setContext] = useState<ReminderDataContext | null>(null);
  const [dataMode, setDataMode] = useState<ReminderDataMode>('demo');
  const [property, setProperty] = useState<PropertyOption | null>(null);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('general');
  const [dueDate, setDueDate] = useState('');
  const [linkedType, setLinkedType] = useState<LinkTypeOption>('');
  const [linkedId, setLinkedId] = useState('');
  const [frequency, setFrequency] = useState<ReminderFrequency>('none');
  const [priority, setPriority] = useState<ReminderPriority>('normal');
  const [status, setStatus] = useState<ReminderStatus>('open');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [linkedFilter, setLinkedFilter] = useState('');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'status'>('due_date');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [nextContext, assetContext, utilityContext] = await Promise.all([
          getReminderDataContext(),
          getAssetDataContext(),
          getUtilityDataContext()
        ]);

        const [nextReminders, nextAssets, nextUtilities] = await Promise.all([
          getRemindersForContext(nextContext),
          getAssetsForContext(assetContext),
          getUtilitiesForContext(utilityContext)
        ]);

        const nextRooms =
          nextContext.mode === 'supabase' && nextContext.property
            ? await getRoomsForProperty(nextContext.property.id)
            : getDemoRooms();
        const nextProperty =
          nextContext.mode === 'supabase'
            ? nextContext.property
            : getDemoActiveProperty();

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setProperty(
          nextProperty
            ? {
                id: nextProperty.id,
                nickname: nextProperty.nickname
              }
            : null
        );
        setReminders(nextReminders);
        setRooms(nextRooms);
        setAssets(nextAssets);
        setUtilities(nextUtilities);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load reminders.');
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

  const linkedOptions = useMemo(() => {
    if (linkedType === 'property') {
      return property ? [{ id: property.id, label: property.nickname || 'Current property' }] : [];
    }

    if (linkedType === 'room') {
      return rooms.map((room) => ({ id: room.id, label: room.name }));
    }

    if (linkedType === 'utility') {
      return utilities.map((utility) => ({ id: utility.id, label: utility.name }));
    }

    if (linkedType === 'asset') {
      return assets.map((asset) => ({ id: asset.id, label: asset.name }));
    }

    return [] as Array<{ id: string; label: string }>;
  }, [linkedType, property, rooms, utilities, assets]);

  useEffect(() => {
    setLinkedId((currentId) =>
      linkedOptions.some((option) => option.id === currentId) ? currentId : linkedOptions[0]?.id || ''
    );
  }, [linkedOptions]);

  const remindersByStatus = useMemo(
    () => ({
      open: reminders.filter((reminder) => reminder.status === 'open'),
      completed: reminders.filter((reminder) => reminder.status === 'completed'),
      dismissed: reminders.filter((reminder) => reminder.status === 'dismissed')
    }),
    [reminders]
  );

  const filteredReminders = useMemo(() => {
    const priorityRank = new Map(REMINDER_PRIORITIES.map((value, index) => [value, index]));
    const statusRank = new Map(REMINDER_STATUSES.map((value, index) => [value, index]));

    return reminders
      .filter((reminder) => {
        const matchesStatus = !statusFilter || reminder.status === statusFilter;
        const matchesType = !typeFilter || reminder.reminder_type === typeFilter;
        const matchesLinked =
          !linkedFilter ||
          reminder.linked_type === linkedFilter ||
          (linkedFilter === 'room' && Boolean(reminder.room_id)) ||
          (linkedFilter === 'asset' && Boolean(reminder.asset_id)) ||
          (linkedFilter === 'utility' && Boolean(reminder.utility_id));

        return matchesStatus && matchesType && matchesLinked;
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return (priorityRank.get(b.priority) ?? 0) - (priorityRank.get(a.priority) ?? 0);
        }

        if (sortBy === 'status') {
          return (statusRank.get(a.status) ?? 0) - (statusRank.get(b.status) ?? 0);
        }

        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      });
  }, [reminders, statusFilter, typeFilter, linkedFilter, sortBy]);

  const getLinkedLabel = (reminder: ReminderRow) => {
    if (!reminder.linked_type || !reminder.linked_id) {
      return 'Not linked';
    }

    if (reminder.linked_type === 'property') {
      return property?.nickname || 'Property';
    }

    if (reminder.linked_type === 'room') {
      return rooms.find((room) => room.id === reminder.linked_id)?.name || 'Room';
    }

    if (reminder.linked_type === 'utility') {
      return utilities.find((utility) => utility.id === reminder.linked_id)?.name || 'Utility';
    }

    return assets.find((asset) => asset.id === reminder.linked_id)?.name || 'Asset';
  };

  const addReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!context) {
      setError('Reminder storage is still loading. Please try again.');
      return;
    }

    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    if (linkedType && !linkedId) {
      setError('Choose a linked item, or set the linked type to not linked.');
      return;
    }

    setSaving(true);

    try {
      const newReminder = await createReminderForContext(context, {
        title,
        description,
        reminder_type: reminderType,
        due_date: dueDate || null,
        linked_type: linkedType || null,
        linked_id: linkedType ? linkedId : null,
        frequency,
        priority,
        status,
        source: 'manual'
      });

      setReminders((currentReminders) => [newReminder, ...currentReminders]);
      setTitle('');
      setDescription('');
      setReminderType('general');
      setDueDate('');
      setLinkedType('');
      setFrequency('none');
      setPriority('normal');
      setStatus('open');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save reminder.');
    } finally {
      setSaving(false);
    }
  };

  const setReminderStatus = async (id: string, nextStatus: ReminderStatus) => {
    if (!context) return;

    setActingId(id);
    setError('');

    try {
      const updatedReminder = await updateReminderStatusForContext(context, id, nextStatus);

      if (updatedReminder) {
        setReminders((currentReminders) =>
          currentReminders.map((reminder) =>
            reminder.id === updatedReminder.id ? updatedReminder : reminder
          )
        );
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update reminder.');
    } finally {
      setActingId(null);
    }
  };

  const removeReminder = async (id: string) => {
    if (!context) return;

    setActingId(id);
    setError('');

    try {
      await deleteReminderForContext(context, id);
      setReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete reminder.');
    } finally {
      setActingId(null);
    }
  };

  const formDisabled = loading || saving || (dataMode === 'supabase' && !context?.property);

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Track home tasks and dates with simple in-app reminders."
      />

      <Card>
        <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
          {dataMode === 'supabase'
            ? 'Signed-in mode: reminders save to Supabase.'
            : 'Demo mode: reminders save to localStorage.'}
        </p>
        {error ? (
          <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
            {error}
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Add reminder</h2>
        {dataMode === 'supabase' && !context?.property ? (
          <div>
            <p style={{ color: '#6b7280' }}>Create a property before adding Supabase reminders.</p>
            <Link href="/create-property">
              <Button type="button">Create property</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={addReminder} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Change HVAC filter"
                disabled={formDisabled}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional notes"
                disabled={formDisabled}
                rows={3}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Reminder type</span>
                <select
                  value={reminderType}
                  onChange={(event) => setReminderType(event.target.value as ReminderType)}
                  disabled={formDisabled}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  {REMINDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={formDisabled}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Frequency</span>
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as ReminderFrequency)}
                  disabled={formDisabled}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  {REMINDER_FREQUENCIES.map((option) => (
                    <option key={option} value={option}>
                      {formatEnumLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Linked type</span>
                <select
                  value={linkedType}
                  onChange={(event) => setLinkedType(event.target.value as LinkTypeOption)}
                  disabled={formDisabled}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  <option value="">Not linked</option>
                  {REMINDER_LINKED_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Linked item</span>
                <select
                  value={linkedId}
                  onChange={(event) => setLinkedId(event.target.value)}
                  disabled={formDisabled || !linkedType}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  <option value="">Not linked</option>
                  {linkedOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ReminderPriority)}
                  disabled={formDisabled}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
                >
                  {REMINDER_PRIORITIES.map((option) => (
                    <option key={option} value={option}>
                      {formatEnumLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ReminderStatus)}
                disabled={formDisabled}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                {REMINDER_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {formatEnumLabel(statusOption)}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <Button type="submit" disabled={formDisabled}>
                {saving ? 'Saving...' : 'Save reminder'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Reminder summary</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <UtilityBadge label={`${remindersByStatus.open.length} open`} />
          <UtilityBadge label={`${remindersByStatus.completed.length} completed`} />
          <UtilityBadge label={`${remindersByStatus.dismissed.length} dismissed`} />
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Find reminders</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              <option value="">All statuses</option>
              {REMINDER_STATUSES.map((value) => (
                <option key={value} value={value}>{formatEnumLabel(value)}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Type</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              <option value="">All types</option>
              {REMINDER_TYPES.map((value) => (
                <option key={value} value={value}>{formatEnumLabel(value)}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Linked to</span>
            <select value={linkedFilter} onChange={(event) => setLinkedFilter(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              <option value="">Any item</option>
              {REMINDER_LINKED_TYPES.map((value) => (
                <option key={value} value={value}>{formatEnumLabel(value)}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'due_date' | 'priority' | 'status')} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
              <option value="due_date">Due date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p style={{ color: '#6b7280', margin: 0 }}>Loading reminders...</p>
        </Card>
      ) : reminders.length === 0 ? (
        <Card>
          <h3 style={{ marginTop: 0 }}>No reminders yet</h3>
          <p style={{ color: '#6b7280' }}>Add your first reminder to track upcoming home tasks.</p>
        </Card>
      ) : filteredReminders.length === 0 ? (
        <Card>
          <h3 style={{ marginTop: 0 }}>No reminders match</h3>
          <p style={{ color: '#6b7280' }}>Adjust the filters to see more reminders.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredReminders.map((reminder) => (
            <Card key={reminder.id}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>{reminder.title}</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <UtilityBadge label={formatEnumLabel(reminder.reminder_type)} />
                    <UtilityBadge label={formatEnumLabel(reminder.status)} />
                    <UtilityBadge label={formatEnumLabel(reminder.priority)} />
                    {reminder.linked_type && <UtilityBadge label={formatEnumLabel(reminder.linked_type)} />}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    <div>
                      <strong>Due:</strong> {formatDateLabel(reminder.due_date)}
                    </div>
                    <div>
                      <strong>Linked:</strong> {getLinkedLabel(reminder)}
                    </div>
                    {reminder.frequency !== 'none' && (
                      <div>
                        <strong>Frequency:</strong> {formatEnumLabel(reminder.frequency)}
                      </div>
                    )}
                    {reminder.description && (
                      <div style={{ marginTop: 4, color: '#4b5563' }}>{reminder.description}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                  <button
                    type="button"
                    onClick={() => setReminderStatus(reminder.id, 'open')}
                    disabled={actingId === reminder.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      cursor: actingId === reminder.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Mark open
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderStatus(reminder.id, 'completed')}
                    disabled={actingId === reminder.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      cursor: actingId === reminder.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderStatus(reminder.id, 'dismissed')}
                    disabled={actingId === reminder.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      cursor: actingId === reminder.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReminder(reminder.id)}
                    disabled={actingId === reminder.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      cursor: actingId === reminder.id ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/dashboard">
          <Button type="button">Back to dashboard</Button>
        </Link>
      </div>
    </>
  );
}
