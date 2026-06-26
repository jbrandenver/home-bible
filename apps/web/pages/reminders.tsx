import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatEnumLabel, REMINDER_LINKED_TYPES, REMINDER_STATUSES, REMINDER_TYPES } from '@home-bible/shared';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';

type Reminder = {
  id: string;
  title: string;
  reminder_type: string;
  due_date: string;
  linked_type?: string | null;
  linked_id?: string | null;
  repeat_rule?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Property = {
  id?: string;
  nickname?: string;
};

type Room = { id: string; name: string };

type Utility = { id: string; name: string };

type Asset = { id: string; name: string };

function createLocalId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [title, setTitle] = useState('');
  const [reminderType, setReminderType] = useState<(typeof REMINDER_TYPES)[number]>('custom');
  const [dueDate, setDueDate] = useState('');
  const [linkedType, setLinkedType] = useState<(typeof REMINDER_LINKED_TYPES)[number]>('asset');
  const [linkedId, setLinkedId] = useState('');
  const [repeatRule, setRepeatRule] = useState('none');
  const [status, setStatus] = useState<(typeof REMINDER_STATUSES)[number]>('open');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedReminders = window.localStorage.getItem('homeBible.reminders');
    const storedProperty = window.localStorage.getItem('homeBible.activeProperty');
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    const storedUtilities = window.localStorage.getItem('homeBible.utilities');
    const storedAssets = window.localStorage.getItem('homeBible.assets');

    if (storedReminders) {
      setReminders(JSON.parse(storedReminders));
    }

    if (storedProperty) {
      setProperty(JSON.parse(storedProperty));
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

    setDueDate(new Date().toISOString().slice(0, 10));
  }, []);

  const linkedOptions = useMemo(() => {
    if (linkedType === 'property') {
      if (!property) {
        return [];
      }

      return [
        {
          id: property.id || 'active-property',
          label: property.nickname || 'Current property'
        }
      ];
    }

    if (linkedType === 'room') {
      return rooms.map((room) => ({ id: room.id, label: room.name }));
    }

    if (linkedType === 'utility') {
      return utilities.map((utility) => ({ id: utility.id, label: utility.name }));
    }

    return assets.map((asset) => ({ id: asset.id, label: asset.name }));
  }, [linkedType, property, rooms, utilities, assets]);

  useEffect(() => {
    setLinkedId(linkedOptions[0]?.id || '');
  }, [linkedOptions]);

  const remindersByStatus = useMemo(
    () => ({
      open: reminders.filter((reminder) => reminder.status === 'open'),
      snoozed: reminders.filter((reminder) => reminder.status === 'snoozed'),
      done: reminders.filter((reminder) => reminder.status === 'done')
    }),
    [reminders]
  );

  const getLinkedLabel = (reminder: Reminder) => {
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

  const saveReminders = (next: Reminder[]) => {
    setReminders(next);
    window.localStorage.setItem('homeBible.reminders', JSON.stringify(next));
  };

  const addReminder = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Reminder title is required.');
      return;
    }

    if (!dueDate) {
      setError('Due date is required.');
      return;
    }

    const newReminder: Reminder = {
      id: createLocalId(),
      title: title.trim(),
      reminder_type: reminderType,
      due_date: dueDate,
      linked_type: linkedType || null,
      linked_id: linkedId || null,
      repeat_rule: repeatRule || 'none',
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveReminders([newReminder, ...reminders]);

    setTitle('');
    setReminderType('custom');
    setDueDate(new Date().toISOString().slice(0, 10));
    setLinkedType('asset');
    setRepeatRule('none');
    setStatus('open');
  };

  const setReminderStatus = (id: string, nextStatus: (typeof REMINDER_STATUSES)[number]) => {
    const updated = reminders.map((reminder) => {
      if (reminder.id !== id) {
        return reminder;
      }

      return {
        ...reminder,
        status: nextStatus,
        updated_at: new Date().toISOString()
      };
    });

    saveReminders(updated);
  };

  const removeReminder = (id: string) => {
    saveReminders(reminders.filter((reminder) => reminder.id !== id));
  };

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Track home tasks and dates with simple in-app reminders."
      />

      <Card>
        <h2 style={{ marginTop: 0 }}>Add reminder</h2>
        <form onSubmit={addReminder} style={{ display: 'grid', gap: 12 }}>
          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b'
              }}
            >
              {error}
            </div>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Change HVAC filter"
              style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Reminder type</span>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value as (typeof REMINDER_TYPES)[number])}
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
                onChange={(e) => setDueDate(e.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof REMINDER_STATUSES)[number])}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
                {REMINDER_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {formatEnumLabel(statusOption)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Linked type</span>
              <select
                value={linkedType}
                onChange={(e) => setLinkedType(e.target.value as (typeof REMINDER_LINKED_TYPES)[number])}
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              >
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
                onChange={(e) => setLinkedId(e.target.value)}
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
              <span style={{ fontWeight: 600 }}>Repeat rule</span>
              <input
                type="text"
                value={repeatRule}
                onChange={(e) => setRepeatRule(e.target.value)}
                placeholder="none"
                style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>
          </div>

          <div>
            <Button type="submit">Save reminder</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Reminder summary</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <UtilityBadge label={`${remindersByStatus.open.length} open`} />
          <UtilityBadge label={`${remindersByStatus.snoozed.length} snoozed`} />
          <UtilityBadge label={`${remindersByStatus.done.length} done`} />
        </div>
      </Card>

      {reminders.length === 0 ? (
        <Card>
          <h3 style={{ marginTop: 0 }}>No reminders yet</h3>
          <p style={{ color: '#6b7280' }}>Add your first reminder to track upcoming home tasks.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {reminders
            .slice()
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .map((reminder) => (
              <Card key={reminder.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>{reminder.title}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <UtilityBadge label={formatEnumLabel(reminder.reminder_type)} />
                      <UtilityBadge label={formatEnumLabel(reminder.status)} />
                      {reminder.linked_type && <UtilityBadge label={formatEnumLabel(reminder.linked_type)} />}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Due:</strong> {reminder.due_date}
                      </div>
                      <div>
                        <strong>Linked:</strong> {getLinkedLabel(reminder)}
                      </div>
                      {reminder.repeat_rule && reminder.repeat_rule !== 'none' && (
                        <div>
                          <strong>Repeat:</strong> {reminder.repeat_rule}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, 'open')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      Mark open
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, 'snoozed')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      Snooze
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, 'done')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      Mark done
                    </button>
                    <button
                      type="button"
                      onClick={() => removeReminder(reminder.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        cursor: 'pointer'
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
