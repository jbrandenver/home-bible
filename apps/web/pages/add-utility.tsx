import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { UTILITY_TYPES, formatEnumLabel, sortEnumForDisplay } from '@home-folder/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getDemoRooms } from '../lib/demoStorage';
import {
  getAvailableLocationPresets,
  isLocationPresetValue,
  resolveLocationRoomId,
  rollbackCreatedLocation
} from '../lib/locationPresets';
import { getRoomsForProperty } from '../lib/rooms';
import { createServiceRecordForContext, getServiceRecordDataContext } from '../lib/serviceRecords';
import {
  createUtilityForContext,
  getUtilityDataContext,
  type UtilityDataContext,
  type UtilityDataMode
} from '../lib/utilities';
import { formatRoomLocation } from '../lib/roomLabels';
import { usePropertyAccess } from '../lib/access';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';

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
  const access = usePropertyAccess();
  const router = useRouter();
  const [name, setName] = useState('');
  const [utilityType, setUtilityType] = useState<(typeof UTILITY_TYPES)[number]>('main_water_shutoff');
  const [roomId, setRoomId] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [dateInstalled, setDateInstalled] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [context, setContext] = useState<UtilityDataContext | null>(null);
  const [dataMode, setDataMode] = useState<UtilityDataMode>('demo');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const locationPresets = useMemo(() => getAvailableLocationPresets(rooms), [rooms]);

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

    load().catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setLoading(false);
      }
    });

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
    await saveUtility(false);
  }

  async function saveUtility(addAnother: boolean) {
    if (!name.trim()) {
      setError('Utility name is required.');
      return;
    }

    if (!context) {
      setError('Utility details are still loading. Please try again.');
      return;
    }

    if (isLocationPresetValue(roomId) && context.mode === 'supabase' && !context.property) {
      setError('Create a property before adding utilities.');
      return;
    }

    setSaving(true);
    setError('');
    setSavedNote('');

    const resolutionContext =
      context.mode === 'supabase' && context.property
        ? ({ mode: 'supabase', propertyId: context.property.id } as const)
        : ({ mode: 'demo' } as const);

    let createdRoomId: string | null = null;

    try {
      const resolved = await resolveLocationRoomId(roomId, resolutionContext);
      createdRoomId = resolved.createdRoomId;

      const createdUtility = await createUtilityForContext(context, {
        utility_type: utilityType,
        name: name.trim(),
        room_id: resolved.roomId,
        location_notes: locationNotes.trim() || null,
        emergency_notes: emergencyNotes.trim() || null
      });

      // The install date is history worth keeping — it lands in the service
      // log as an installation record rather than in a field nobody reads.
      if (dateInstalled) {
        const serviceContext = await getServiceRecordDataContext();
        await createServiceRecordForContext(serviceContext, {
          service_title: `${createdUtility.name} installed`,
          service_type: 'installation',
          service_date: dateInstalled,
          utility_id: createdUtility.id,
          room_id: createdUtility.room_id || null
        });
      }

      // A last-service date deserves a complete entry — who came, what it
      // cost — so it hands off to the service history form, prefilled.
      if (lastServiceDate) {
        router.push(
          `/utilities/${createdUtility.id}?serviceDate=${encodeURIComponent(lastServiceDate)}`
        );
        return;
      }

      if (addAnother) {
        setSavedNote(`Saved ${createdUtility.name}. Add the next one.`);
        setName('');
        setRoomId('');
        setLocationNotes('');
        setEmergencyNotes('');
        setDateInstalled('');
        setLastServiceDate('');
        setSaving(false);
        return;
      }

      router.push(`/utilities/${createdUtility.id}`);
    } catch (submitError) {
      // Picking an outdoor preset creates a room before the utility is written.
      // If that write fails, remove the room again rather than leaving an empty
      // "Back yard" on the home map that the user never asked for.
      await rollbackCreatedLocation(createdRoomId, resolutionContext);
      setError(submitError instanceof Error ? submitError.message : 'Failed to save utility.');
      setSaving(false);
    }
  }

  // A role that cannot write must not be offered the form. Showing it and
  // letting the save fail is how a viewer met a raw Postgres error.
  if (!access.loading && !access.canWrite) {
    return (
      <>
        <PageHeader title="Add utility" />
        <ViewOnlyNotice role={access.role} action="add utilities" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Add utility"
        description="Add a shutoff, panel, system, or other critical home utility."
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/utilities" variant="secondary">Back to utilities</ActionLink>
          <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
        </div>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <p style={{ margin: 0, color: dataMode === 'supabase' ? 'var(--status-good)' : 'var(--text-muted)' }}>
            {dataMode === 'supabase'
              ? 'Saved to your account.'
              : 'Demo data is stored only in this browser.'}
          </p>
          {dataMode === 'demo' && !context?.supabaseConfigured ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-clay)' }}>
              Account saving is not available in this local build. Demo data stays only in this browser.
            </p>
          ) : null}
          {dataMode === 'supabase' && context && !context.property ? (
            <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-clay)' }}>
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
              {sortEnumForDisplay(UTILITY_TYPES).map((type) => (
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
              Location (optional)
            </label>
            <Select
              id="roomId"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? 'Loading locations...' : 'Not assigned'}</option>
              {rooms.length > 0 ? (
                <optgroup label="Rooms & spaces">
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {formatRoomLocation(room)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {locationPresets.length > 0 ? (
                <optgroup label="Outdoor & exterior">
                  {locationPresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
            <p style={{ marginTop: 6, marginBottom: 0, color: 'var(--text-muted)', fontSize: 14 }}>
              Pick a room, or an outdoor spot like the back yard or a side of the house.
            </p>
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

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <label
                htmlFor="dateInstalled"
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 8
                }}
              >
                Date installed (optional)
              </label>
              <Input
                id="dateInstalled"
                type="date"
                value={dateInstalled}
                onChange={(event) => setDateInstalled(event.target.value)}
              />
              <p style={{ marginTop: 6, marginBottom: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                Recorded in the service history as an installation.
              </p>
            </div>
            <div>
              <label
                htmlFor="lastServiceDate"
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 8
                }}
              >
                Date of last service (optional)
              </label>
              <Input
                id="lastServiceDate"
                type="date"
                value={lastServiceDate}
                onChange={(event) => setLastServiceDate(event.target.value)}
              />
              <p style={{ marginTop: 6, marginBottom: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                After saving, you&rsquo;ll complete the service history entry for this date.
              </p>
            </div>
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
            <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>
              {error}
            </p>
          ) : null}
          {savedNote ? (
            <p style={{ color: 'var(--status-good)', fontWeight: 600, margin: 0 }} role="status">
              {savedNote}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save utility'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => saveUtility(true)}
              disabled={saving || loading}
            >
              Save &amp; add another
            </Button>
            <button
              type="button"
              onClick={() => router.push('/utilities')}
              style={{
                padding: '8px 16px',
                background: 'var(--surface-page)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
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
