import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UTILITY_TYPES, formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Input, Select, Button } from '@home-bible/ui';

type Room = {
  id: string;
  name: string;
};

export default function AddUtilityPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [utilityType, setUtilityType] = useState<(typeof UTILITY_TYPES)[number]>('main_water_shutoff');
  const [roomId, setRoomId] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedRooms = window.localStorage.getItem('homeBible.rooms');
    if (storedRooms) {
      setRooms(JSON.parse(storedRooms));
    }
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Utility name is required.');
      return;
    }

    const utility = {
      id: crypto.randomUUID(),
      utility_type: utilityType,
      name: name.trim(),
      room_id: roomId || undefined,
      location_notes: locationNotes.trim() || undefined,
      emergency_notes: emergencyNotes.trim() || undefined,
      created_at: new Date().toISOString()
    };

    const existingUtilities = JSON.parse(window.localStorage.getItem('homeBible.utilities') || '[]');
    const updated = [...existingUtilities, utility];
    window.localStorage.setItem('homeBible.utilities', JSON.stringify(updated));

    router.push('/utilities');
  }

  return (
    <>
      <PageHeader
        title="Add Utility"
        description="Document key utility locations and emergency information."
      />

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
            >
              <option value="">Not assigned</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
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
            <Button type="submit">Save Utility</Button>
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
    </>
  );
}
