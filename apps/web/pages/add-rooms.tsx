import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ROOM_TYPES } from '@home-bible/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-bible/ui';
import { getCurrentUser, isSupabaseConfigured } from '../lib/auth';
import { getPrimaryPropertyForUser } from '../lib/properties';
import { createRoomsForProperty, getRoomsForProperty, updateRoomForProperty } from '../lib/rooms';
import { formatRoomLocation, formatRoomTypeLabel } from '../lib/roomLabels';
import { getDemoActiveProperty, getDemoRooms, setDemoRooms } from '../lib/demoStorage';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
  notes?: string | null;
};

export default function AddRoomsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>('bedroom');
  const [floorName, setFloorName] = useState('Main Floor');
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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const user = await getCurrentUser();

      if (user && supabaseReady) {
        const property = await getPrimaryPropertyForUser(user.id);
        if (!isMounted) {
          return;
        }

        setUserId(user.id);

        if (property) {
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
          }
          return;
        }
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
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

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

    setError('');

    setIsSubmitting(true);

    if (userId && supabaseReady && activePropertyId) {
      try {
        const remoteRooms = await createRoomsForProperty(activePropertyId, [
          {
            name: roomName.trim(),
            room_type: roomType,
            floor_name: floorName.trim() || 'Main Floor'
          }
        ]);

        setRooms(
          remoteRooms.map((room) => ({
            id: room.id,
            name: room.name,
            room_type: room.room_type,
            floor_name: room.floor_name,
            notes: room.notes || null
          }))
        );
        setRoomName('');
        setRoomType('bedroom');
        setIsSubmitting(false);
        return;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Failed to save room to your account.');
        setIsSubmitting(false);
        return;
      }
    }

    const nextRooms = [
      ...rooms,
      {
        id: crypto.randomUUID(),
        name: roomName.trim(),
        room_type: roomType,
        floor_name: floorName.trim() || 'Main Floor'
      }
    ];

    saveRooms(nextRooms);
    setRoomName('');
    setRoomType('bedroom');
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

    if (userId && supabaseReady && activePropertyId) {
      try {
        const remoteRooms = await updateRoomForProperty(activePropertyId, editingRoomId, {
          name: editRoomName.trim(),
          room_type: editRoomType,
          floor_name: editFloorName.trim() || 'Main Floor',
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
            name: editRoomName.trim(),
            room_type: editRoomType,
            floor_name: editFloorName.trim() || 'Main Floor',
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

  return (
    <>
      <PageHeader
          title={`Add rooms & spaces for ${propertyNickname}`}
          description="Start simple. You can add detailed outlets, vents, utilities, appliances, and accessories later."
        />

        {userId ? (
          <Card>
            <p style={{ margin: 0, color: '#065f46' }}>
              Saved to your account.
            </p>
          </Card>
        ) : (
          <Card>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Demo data is stored only in this browser.
            </p>
            {!supabaseReady ? (
              <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
                Account saving is not available in this local build. Demo data stays only in this browser.
              </p>
            ) : null}
          </Card>
        )}

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <form onSubmit={handleAddRoom} style={{ display: 'grid', gap: 20 }}>
              <div>
                <label htmlFor="roomName" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  Room or space name
                </label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="Example: Kitchen"
                />
              </div>

              <div>
                <label htmlFor="roomType" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  Room or space type
                </label>
                <Select
                  id="roomType"
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value as (typeof ROOM_TYPES)[number])}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatRoomTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="floorName" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  Floor
                </label>
                <Input
                  id="floorName"
                  value={floorName}
                  onChange={(event) => setFloorName(event.target.value)}
                  placeholder="Example: Main Floor"
                />
              </div>

              {error ? (
                <p style={{ color: '#b91c1c', fontWeight: 700, margin: 0 }}>
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
              <p style={{ color: '#6b7280' }}>No rooms yet - let's map the house.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      border: '1px solid #e5e7eb',
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
                              border: '1px solid #d1d5db',
                              minHeight: 72,
                              fontFamily: 'inherit'
                            }}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button type="submit" disabled={isEditing}>{isEditing ? 'Saving...' : 'Save changes'}</Button>
                          <Button type="button" disabled={isEditing} onClick={cancelEditingRoom} style={{ background: '#6b7280' }}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}>
                        <div>
                          <strong>{room.name}</strong>
                          <div style={{ color: '#6b7280' }}>
                            {formatRoomTypeLabel(room.room_type)} • {formatRoomLocation(room)}
                          </div>
                          {room.notes ? <div style={{ color: '#6b7280', marginTop: 4 }}>{room.notes}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingRoom(room)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
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
            )}
          </Card>
        </div>
      </>
    );
  }
