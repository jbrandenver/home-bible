import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UTILITY_TYPES, formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-bible/ui';
import { getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';
import {
  createUtilityForContext,
  getUtilityDataContext,
  type UtilityDataContext,
  type UtilityDataMode
} from '../lib/utilities';
import { formatRoomLocation } from '../lib/roomLabels';

type Room = {
  id: string;
  name: string;
  room_type?: string | null;
  floor_name?: string | null;
};

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AddUtilityPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [utilityType, setUtilityType] = useState<(typeof UTILITY_TYPES)[number]>('main_water_shutoff');
  const [roomId, setRoomId] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const nextContext = await getUtilityDataContext();
        const roomList =
          nextContext.mode === 'supabase' && nextContext.property
            ? await getRoomsForProperty(nextContext.property.id)
            : getDemoRooms();

        if (!isMounted) {
          return;
        }

        setContext(nextContext);
        setDataMode(nextContext.mode);
        setRooms(roomList);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load rooms.');
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

    const queryUtilityType = queryValue(router.query.utilityType);
    const queryRoomId = queryValue(router.query.roomId);
    const queryName = queryValue(router.query.name);
    const queryLocationNotes = queryValue(router.query.locationNotes);

    if (queryUtilityType && UTILITY_TYPES.includes(queryUtilityType as (typeof UTILITY_TYPES)[number])) {
      setUtilityType(queryUtilityType as (typeof UTILITY_TYPES)[number]);
    }

    if (queryRoomId) {
      setRoomId(queryRoomId);
    }

    if (queryName) {
      setName(queryName);
    }

    if (queryLocationNotes) {
      setLocationNotes(queryLocationNotes);
    }
  }, [router.isReady, router.query.locationNotes, router.query.name, router.query.roomId, router.query.utilityType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Utility name is required.');
      return;
    }

    if (!context) {
      setError('Utility details are still loading. Please try again.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const createdUtility = await createUtilityForContext(context, {
        utility_type: utilityType,
        name: name.trim(),
        room_id: roomId || null,
        location_notes: locationNotes.trim() || null,
        emergency_notes: emergencyNotes.trim() || null
      });

      router.push(`/utilities/${createdUtility.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save utility.');
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Add utility"
        description="Add a shutoff, panel, system, or other critical home utility."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? '#065f46' : '#6b7280' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {dataMode === 'demo' && !context?.supabaseConfigured ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
              Account saving is not available in this local build. Demo data stays only in this browser.
            </p>
          ) : null}
          {dataMode === 'supabase' && context && !context.property ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
              Create a property before adding utilities to your account.
            </p>
          ) : null}
        </Card>

        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
          <div>
            <label
              htmlFor="name"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Utility name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Front yard water shutoff"
            />
          </div>

          <div>
            <label
              htmlFor="utilityType"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Utility type
            </label>
            <Select
              id="utilityType"
              value={utilityType}
              onChange={(event) => setUtilityType(event.target.value as (typeof UTILITY_TYPES)[number])}
            >
              {UTILITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatEnumLabel(type)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="roomId"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Room (optional)
            </label>
            <Select
              id="roomId"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? 'Loading rooms...' : 'Not assigned'}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {formatRoomLocation(room)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="locationNotes"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Location notes
            </label>
            <Input
              id="locationNotes"
              value={locationNotes}
              onChange={(event) => setLocationNotes(event.target.value)}
              placeholder="Example: In the basement corner near furnace"
            />
          </div>

          <div>
            <label
              htmlFor="emergencyNotes"
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Emergency notes
            </label>
            <Input
              id="emergencyNotes"
              value={emergencyNotes}
              onChange={(event) => setEmergencyNotes(event.target.value)}
              placeholder="Example: Valve is sticky, use pipe wrench to turn"
            />
          </div>

          {error ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save utility'}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/utilities')}
              style={{
                padding: '8px 16px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Cancel
            </button>
          </div>
          </form>
        </Card>
      </div>
    </>
  );
}
