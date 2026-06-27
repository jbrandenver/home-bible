import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, FloorSection, RoomCard, UtilityBadge } from '@home-bible/ui';
import { getCurrentUser, isSupabaseConfigured } from '../lib/auth';
import { getDemoActiveProperty, getDemoCollection, getDemoRooms } from '../lib/demoStorage';
import { getPrimaryPropertyForUser } from '../lib/properties';
import { getRoomsForProperty } from '../lib/rooms';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

type Utility = {
  id: string;
  utility_type: string;
  name: string;
  room_id?: string;
};

type Asset = {
  id: string;
  asset_type: string;
  name: string;
  room_id?: string;
};

export default function HomeMapPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const supabaseReady = isSupabaseConfigured();
      const user = await getCurrentUser();
      let foundSupabaseProperty = false;

      if (user && supabaseReady) {
        const property = await getPrimaryPropertyForUser(user.id);
        if (property && isMounted) {
          foundSupabaseProperty = true;
          setDataMode('supabase');
          setHasProperty(true);
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
        }
      }

      if (!isMounted) {
        return;
      }

      if (!user || !supabaseReady || !foundSupabaseProperty) {
        const demoProperty = getDemoActiveProperty();
        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(getDemoRooms());
      }

      setUtilities(getDemoCollection<Utility>('homeBible.utilities'));
      setAssets(getDemoCollection<Asset>('homeBible.assets'));
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const roomsByFloor = useMemo(() => {
    return rooms.reduce<Record<string, Room[]>>((acc, room) => {
      if (!acc[room.floor_name]) {
        acc[room.floor_name] = [];
      }

      acc[room.floor_name].push(room);
      return acc;
    }, {});
  }, [rooms]);

  const floorNames = Object.keys(roomsByFloor);

  return (
    <>
      <PageHeader
        title={`${propertyNickname} home map`}
        description="A simple room-based map of your home. This is the foundation for utilities, appliances, accessories, tools, receipts, warranties, and repairs."
        />

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Map overview</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label={`${floorNames.length} floor${floorNames.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${rooms.length} room${rooms.length === 1 ? '' : 's'}`} />
              <UtilityBadge label={`${utilities.length} utilit${utilities.length === 1 ? 'y' : 'ies'}`} />
              <UtilityBadge label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
            </div>
            <p style={{ marginTop: 12, marginBottom: 0, color: '#6b7280' }}>
              {dataMode === 'supabase'
                ? 'Signed-in mode: property, floors, and rooms are loaded from Supabase.'
                : 'Demo mode: property, floors, and rooms are loaded from localStorage.'}
            </p>
          </Card>

          {!hasProperty ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>No property yet</h2>
              <p style={{ color: '#6b7280' }}>Create a property first to build your home map.</p>
              <Link href="/create-property">
                <Button type="button">Create property</Button>
              </Link>
            </Card>
          ) : rooms.length === 0 ? (
            <Card>
              <h2 style={{ marginTop: 0 }}>No rooms yet</h2>
              <p style={{ color: '#6b7280' }}>
                Add rooms first so Home Bible can build your home map.
              </p>
              <Link href="/add-rooms">
                <Button type="button">Add rooms</Button>
              </Link>
            </Card>
          ) : (
            floorNames.map((floorName) => (
              <FloorSection key={floorName} title={floorName}>
                {roomsByFloor[floorName].map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.id}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <RoomCard
                      name={room.name}
                      type={formatEnumLabel(room.room_type)}
                    />
                  </Link>
                ))}
              </FloorSection>
            ))
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button type="button">Back to dashboard</Button>
            </Link>
            <Link href="/add-rooms">
              <Button type="button">Add more rooms</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }
