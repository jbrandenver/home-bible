import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { ROOM_TYPES } from '@home-folder/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-folder/ui';
import { getCurrentUser, isSupabaseConfigured } from '../lib/auth';
import { FLOOR_SUGGESTIONS, sortFloorNames } from '../lib/floorOrder';
import { getPrimaryPropertyForUser } from '../lib/properties';
import { createRoomsForProperty, getRoomsForProperty, updateRoomForProperty } from '../lib/rooms';
import { formatRoomTypeLabel } from '../lib/roomLabels';
import { CLOSET_PROMPT_TYPES, inferRoomTypeFromName, titleCaseName } from '../lib/roomNameHints';
import { getDemoActiveProperty, getDemoRooms, setDemoRooms } from '../lib/demoStorage';
import { ActionLink } from '../components/ActionLink';
import { usePropertyAccess } from '../lib/access';
import { ViewOnlyNotice } from '../components/ViewOnlyNotice';

// Sentinel for "type a floor that isn't in the dropdown yet". Once a room is
// saved on that floor, the floor becomes a normal dropdown option.
const NEW_FLOOR = '__new_floor__';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
  notes?: string | null;
};

export default function AddRoomsPage() {
  const access = usePropertyAccess();
  const router = useRouter();

  // One explicit mode, so the reassurance banner and the write path can never
  // disagree. Previously the banner branched on `userId` while the write
  // branched on `userId && supabaseReady && activePropertyId`, so a signed-in
  // user with no property saw "Saved to your account" while the data went to
  // localStorage.
  type DataMode = 'loading' | 'account' | 'needs-property' | 'demo' | 'error';

  const [dataMode, setDataMode] = useState<DataMode>('loading');
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>('bedroom');
  // True once the person picks a type by hand — stops the name-based
  // auto-match from fighting their choice.
  const [typeTouched, setTypeTouched] = useState(false);
  const [hasCloset, setHasCloset] = useState(false);
  const [floorChoice, setFloorChoice] = useState('Main Floor');
  const [newFloorName, setNewFloorName] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomType, setEditRoomType] = useState<(typeof ROOM_TYPES)[number]>('bedroom');
  const [editFloorName, setEditFloorName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  // Floors you can pick from: the home's own floors plus common suggestions.
  // A typed-in floor joins this list as soon as its first room is saved.
  const floorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const suggestion of FLOOR_SUGGESTIONS) {
      seen.set(suggestion.toLowerCase(), suggestion);
    }
    for (const room of rooms) {
      const name = (room.floor_name || '').trim();
      if (name) seen.set(name.toLowerCase(), name);
    }
    if (floorChoice !== NEW_FLOOR && floorChoice.trim()) {
      seen.set(floorChoice.toLowerCase(), floorChoice);
    }
    return sortFloorNames([...seen.values()]);
  }, [rooms, floorChoice]);

  // Group the added rooms by floor (canonical floor order, rooms A→Z) so each
  // level reads as its own section.
  const roomsByFloor = useMemo(() => {
    const groups = new Map<string, Room[]>();
    for (const room of rooms) {
      const floor = (room.floor_name || 'Main Floor').trim() || 'Main Floor';
      const existing = groups.get(floor) || [];
      existing.push(room);
      groups.set(floor, existing);
    }
    return sortFloorNames([...groups.keys()]).map((floor) => ({
      floor,
      rooms: (groups.get(floor) || []).slice().sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [rooms]);

  const closetEligible = CLOSET_PROMPT_TYPES.includes(roomType);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const user = await getCurrentUser();

      if (user && supabaseReady) {
        const property = await getPrimaryPropertyForUser(user.id);
        if (!isMounted) {
          return;
        }

        if (!property) {
          // Signed in but no property yet. Critically, do NOT fall through to
          // the demo branch: adopting the localStorage property id here made
          // the save path believe it was authorised, and Postgres rejected the
          // insert with a raw "violates row-level security policy" message.
          setDataMode('needs-property');
          setActivePropertyId(null);
          setRooms([]);
          return;
        }

        setActivePropertyId(property.id);
        setPropertyNickname(property.nickname || 'Your property');
        const remoteRooms = await getRoomsForProperty(property.id);
        if (isMounted) {
          setRooms(
            remoteRooms.map((room) => ({
              id: room.id,
              name: room.name,
              room_type: room.room_type,
              floor_name: room.floor_name,
              notes: room.notes || null
            }))
          );
          setDataMode('account');
        }
        return;
      }

      const demoProperty = getDemoActiveProperty();
      const demoRooms = getDemoRooms();

      if (!isMounted) {
        return;
      }

      if (demoProperty) {
        setPropertyNickname(demoProperty.nickname || 'Your property');
        setActivePropertyId(demoProperty.id);
      }

      setRooms(demoRooms);
      setDataMode('demo');
    }

    load().catch((err) => {
      if (isMounted) {
        // Never silently downgrade a signed-in user to demo data on a failure.
        setDataMode('error');
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [supabaseReady]);

  function saveRooms(nextRooms: Room[]) {
    setRooms(nextRooms);
    setDemoRooms(nextRooms);
  }

  function startEditingRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditRoomName(room.name);
    setEditRoomType(room.room_type as (typeof ROOM_TYPES)[number]);
    setEditFloorName(room.floor_name || 'Main Floor');
    setEditNotes(room.notes || '');
    setError('');
  }

  function cancelEditingRoom() {
    setEditingRoomId(null);
    setEditRoomName('');
    setEditRoomType('bedroom');
    setEditFloorName('');
    setEditNotes('');
  }

  async function handleAddRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!roomName.trim()) {
      setError('Room name is required.');
      return;
    }

    const floor =
      floorChoice === NEW_FLOOR
        ? titleCaseName(newFloorName) || ''
        : titleCaseName(floorChoice) || 'Main Floor';

    if (!floor) {
      setError('Name the new floor, or pick one from the list.');
      return;
    }

    // Names are stored title-cased so "master bedroom" files as
    // "Master Bedroom" without anyone thinking about it.
    const name = titleCaseName(roomName);

    const entries = [
      { name, room_type: roomType, floor_name: floor },
      // The closet rides along as its own selectable space — "Master Bedroom
      // Closet" — so the modem on its shelf has a real location without every
      // room needing a closet entered by hand.
      ...(hasCloset && closetEligible
        ? [{ name: `${name} Closet`, room_type: 'closet' as (typeof ROOM_TYPES)[number], floor_name: floor }]
        : [])
    ];

    setError('');
    setIsSubmitting(true);

    function resetForm() {
      setRoomName('');
      setRoomType('bedroom');
      setTypeTouched(false);
      setHasCloset(false);
      // Keep the floor selected — the next room is usually on the same one,
      // and a freshly typed floor becomes a normal dropdown pick.
      setFloorChoice(floor);
      setNewFloorName('');
    }

    if (dataMode === 'account' && activePropertyId) {
      try {
        const remoteRooms = await createRoomsForProperty(activePropertyId, entries);

        setRooms(
          remoteRooms.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name,
            notes: room.notes || null
          }))
        );
        resetForm();
        setIsSubmitting(false);
        return;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Failed to save room to your account.');
        setIsSubmitting(false);
        return;
      }
    }

    // Only demo mode may write to browser storage. Falling through to it in
    // any other mode cleared the form as though the room had been saved, while
    // the room existed nowhere but this browser -- which is worse than an
    // error, because nothing tells the person their work is gone.
    if (dataMode !== 'demo') {
      setError(
        dataMode === 'needs-property'
          ? 'Create a home before adding rooms — there is nowhere to save them yet.'
          : 'We could not save that room to your account. Reload the page and try again.'
      );
      setIsSubmitting(false);
      return;
    }

    const nextRooms = [
      ...rooms,
      ...entries.map((entry) => ({
        id: crypto.randomUUID(),
        name: entry.name,
        room_type: entry.room_type,
        floor_name: entry.floor_name
      }))
    ];

    saveRooms(nextRooms);
    resetForm();
    setIsSubmitting(false);
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRoomId || isEditing) return;

    if (!editRoomName.trim()) {
      setError('Room or space name is required.');
      return;
    }

    setError('');
    setIsEditing(true);

    if (dataMode === 'account' && activePropertyId) {
      try {
        const remoteRooms = await updateRoomForProperty(activePropertyId, editingRoomId, {
          name: titleCaseName(editRoomName),
          room_type: editRoomType,
          floor_name: titleCaseName(editFloorName) || 'Main Floor',
          notes: editNotes.trim() || null
        });

        setRooms(
          remoteRooms.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name,
            notes: room.notes || null
          }))
        );
        cancelEditingRoom();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Failed to update room or space.');
      } finally {
        setIsEditing(false);
      }
      return;
    }

    const nextRooms = rooms.map((room) =>
      room.id === editingRoomId
        ? {
            ...room,
            name: titleCaseName(editRoomName),
            room_type: editRoomType,
            floor_name: titleCaseName(editFloorName) || 'Main Floor',
            notes: editNotes.trim() || null
          }
        : room
    );

    saveRooms(nextRooms);
    cancelEditingRoom();
    setIsEditing(false);
  }

  function handleContinue() {
    if (rooms.length === 0) {
      setError('Add at least one room before continuing.');
      return;
    }

    router.push('/dashboard');
  }

  // A role that cannot write must not be offered the form. Showing it and
  // letting the save fail is how a viewer met a raw Postgres error.
  if (!access.loading && !access.canWrite) {
    return (
      <>
        <PageHeader title="Add rooms" />
        <ViewOnlyNotice role={access.role} action="add rooms" />
      </>
    );
  }

  return (
    <>
      <PageHeader
          title={`Add rooms & spaces for ${propertyNickname}`}
          description="Start simple. You can add detailed outlets, vents, utilities, appliances, and accessories later."
        />

        {dataMode === 'account' ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--status-good)' }}>
              Saved to your account.
            </p>
          </Card>
        ) : dataMode === 'needs-property' ? (
          <Card>
            <p style={{ margin: 0, fontWeight: 600 }}>Create a property first.</p>
            <p style={{ marginTop: 8, marginBottom: 12, color: 'var(--text-muted)' }}>
              Rooms and spaces belong to a property, so there is nowhere to save
              them yet. This takes a moment and only needs doing once.
            </p>
            <ActionLink href="/create-property">Create property</ActionLink>
          </Card>
        ) : dataMode === 'error' ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }}>
              We could not load your home record.
            </p>
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-muted)' }}>
              Nothing has been changed. Reload the page to try again — your saved
              rooms are still in your account.
            </p>
          </Card>
        ) : dataMode === 'loading' ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading your home record...</p>
          </Card>
        ) : (
          <Card>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Demo data is stored only in this browser.
            </p>
            {!supabaseReady ? (
              <p style={{ marginTop: 10, marginBottom: 0, color: 'var(--color-clay)' }}>
                Account saving is not available in this local build. Demo data stays only in this browser.
              </p>
            ) : null}
          </Card>
        )}

        {dataMode === 'needs-property' || dataMode === 'error' || dataMode === 'loading' ? null : (
        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <form onSubmit={handleAddRoom} style={{ display: 'grid', gap: 20 }}>
              <div>
                <label htmlFor="roomName" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  <span>Room or space name</span>
                </label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRoomName(value);
                    // "Guest bedroom" self-selects the Bedroom type; a
                    // hand-picked type is never overridden.
                    if (!typeTouched) {
                      const inferred = inferRoomTypeFromName(value);
                      if (inferred) {
                        setRoomType(inferred);
                      }
                    }
                  }}
                  placeholder="Example: Kitchen"
                />
              </div>

              <div>
                <label htmlFor="roomType" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  <span>Room or space type</span>
                </label>
                <Select
                  id="roomType"
                  value={roomType}
                  onChange={(event) => {
                    setRoomType(event.target.value as (typeof ROOM_TYPES)[number]);
                    setTypeTouched(true);
                  }}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatRoomTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              </div>

              {closetEligible ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={hasCloset}
                    onChange={(event) => setHasCloset(event.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>
                    This room has a closet
                    <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {roomName.trim()
                        ? `Adds "${titleCaseName(roomName)} Closet" as its own selectable space.`
                        : 'Adds the closet as its own selectable space.'}
                    </span>
                  </span>
                </label>
              ) : null}

              <div>
                <label htmlFor="floorChoice" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  <span>Floor</span>
                </label>
                <Select
                  id="floorChoice"
                  value={floorChoice}
                  onChange={(event) => setFloorChoice(event.target.value)}
                >
                  {floorOptions.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                  <option value={NEW_FLOOR}>Add another floor…</option>
                </Select>
                {floorChoice === NEW_FLOOR ? (
                  <div style={{ marginTop: 8 }}>
                    <label htmlFor="newFloorName" style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                      <span>New floor name</span>
                    </label>
                    <Input
                      id="newFloorName"
                      value={newFloorName}
                      onChange={(event) => setNewFloorName(event.target.value)}
                      placeholder="Example: Garden Level"
                      autoFocus
                    />
                  </div>
                ) : null}
              </div>

              {error ? (
                <p style={{ color: 'var(--status-urgent)', fontWeight: 700, margin: 0 }}>
                  {error}
                </p>
              ) : null}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add room or space'}</Button>
                <Button type="button" disabled={isSubmitting} onClick={handleContinue}>Continue to dashboard</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms & spaces added</h2>

            {rooms.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No rooms yet - let's map the house.</p>
            ) : (
              <div style={{ display: 'grid', gap: 20 }}>
                {roomsByFloor.map((group) => (
                  <section key={group.floor}>
                    <h3 className="hb-leader" style={{ margin: '0 0 12px', paddingBottom: 4 }}>{group.floor}</h3>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {group.rooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 14,
                      padding: 16,
                      background: '#fff'
                    }}
                  >
                    {editingRoomId === room.id ? (
                      <form onSubmit={handleSaveEdit} style={{ display: 'grid', gap: 12 }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Room or space name</span>
                          <Input value={editRoomName} onChange={(event) => setEditRoomName(event.target.value)} />
                        </label>
                        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>Room or space type</span>
                            <Select
                              value={editRoomType}
                              onChange={(event) => setEditRoomType(event.target.value as (typeof ROOM_TYPES)[number])}
                            >
                              {ROOM_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {formatRoomTypeLabel(type)}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>Floor</span>
                            <Input value={editFloorName} onChange={(event) => setEditFloorName(event.target.value)} />
                          </label>
                        </div>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>Notes</span>
                          <textarea
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              border: '1px solid var(--border-subtle)',
                              minHeight: 72,
                              fontFamily: 'inherit'
                            }}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button type="submit" disabled={isEditing}>{isEditing ? 'Saving...' : 'Save changes'}</Button>
                          <Button type="button" disabled={isEditing} onClick={cancelEditingRoom} style={{ background: 'var(--text-muted)' }}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
                        <div>
                          <strong>{room.name}</strong>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {formatRoomTypeLabel(room.room_type)}
                          </div>
                          {room.notes ? <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{room.notes}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingRoom(room)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--border-subtle)',
                            background: '#fff',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </Card>
        </div>
        )}
      </>
    );
  }
