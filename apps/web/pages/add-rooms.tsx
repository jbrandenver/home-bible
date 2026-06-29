import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ROOM_TYPES, formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-bible/ui';
import { getCurrentUser, getSupabaseSetupMessage, isSupabaseConfigured } from '../lib/auth';
import { getPrimaryPropertyForUser } from '../lib/properties';
import { createRoomsForProperty, getRoomsForProperty } from '../lib/rooms';
import { getDemoActiveProperty, getDemoRooms, setDemoRooms } from '../lib/demoStorage';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
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
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
                floor_name: room.floor_name
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
            floor_name: room.floor_name
          }))
        );
        setRoomName('');
        setRoomType('bedroom');
        setIsSubmitting(false);
        return;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Failed to save room to Supabase.');
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
          title={`Add rooms for ${propertyNickname}`}
          description="Start simple. You can add detailed outlets, vents, utilities, appliances, and accessories later."
        />

        {userId ? (
          <Card>
            <p style={{ margin: 0, color: '#065f46' }}>
              Signed in mode: floors and rooms save to Supabase.
            </p>
          </Card>
        ) : (
          <Card>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Demo data is stored only in this browser.
            </p>
            {!supabaseReady ? (
              <p style={{ marginTop: 10, marginBottom: 0, color: '#9a3412' }}>
                {getSupabaseSetupMessage()}
              </p>
            ) : null}
          </Card>
        )}

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <form onSubmit={handleAddRoom} style={{ display: 'grid', gap: 20 }}>
              <div>
                <label htmlFor="roomName" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  Room name
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
                  Room type
                </label>
                <Select
                  id="roomType"
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value as (typeof ROOM_TYPES)[number])}
                >
                  {ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
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
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add room'}</Button>
                <Button type="button" disabled={isSubmitting} onClick={handleContinue}>Continue to dashboard</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Rooms added</h2>

            {rooms.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No rooms added yet.</p>
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
                    <strong>{room.name}</strong>
                    <div style={{ color: '#6b7280' }}>
                      {formatEnumLabel(room.room_type)} • {room.floor_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </>
    );
  }
