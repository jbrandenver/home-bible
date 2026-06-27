import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEnumLabel } from '@home-bible/shared';
import { PageHeader, Card, Button, FloorSection, RoomCard, UtilityBadge } from '@home-bible/ui';
import { getAssetDataContext, getAssetsForContext, type AssetRow } from '../lib/assets';
import { getDemoActiveProperty, getDemoRooms } from '../lib/demoStorage';
import { getRoomsForProperty } from '../lib/rooms';
import { getUtilitiesForContext, getUtilityDataContext, type UtilityRow } from '../lib/utilities';

type Room = {
  id: string;
  name: string;
  room_type: string;
  floor_name: string;
};

export default function HomeMapPage() {
  const [propertyNickname, setPropertyNickname] = useState('Your property');
  const [dataMode, setDataMode] = useState<'demo' | 'supabase'>('demo');
  const [hasProperty, setHasProperty] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [utilityError, setUtilityError] = useState('');
  const [assetError, setAssetError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setUtilityError('');
      setAssetError('');

      const [utilityContext, assetContext] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext()
      ]);
      let nextUtilities: UtilityRow[] = [];
      let nextAssets: AssetRow[] = [];

      try {
        nextUtilities = await getUtilitiesForContext(utilityContext);
      } catch (loadError) {
        if (isMounted) {
          setUtilityError(loadError instanceof Error ? loadError.message : 'Failed to load utilities.');
        }
      }

      try {
        nextAssets = await getAssetsForContext(assetContext);
      } catch (loadError) {
        if (isMounted) {
          setAssetError(loadError instanceof Error ? loadError.message : 'Failed to load assets.');
        }
      }

      if (!isMounted) {
        return;
      }

      setDataMode(utilityContext.mode);
      setUtilities(nextUtilities);
      setAssets(nextAssets);

      if (utilityContext.mode === 'supabase') {
        setHasProperty(Boolean(utilityContext.property));
        setPropertyNickname(utilityContext.property?.nickname || 'Your property');

        if (utilityContext.property) {
          const remoteRooms = await getRoomsForProperty(utilityContext.property.id);
          if (!isMounted) {
            return;
          }

          setRooms(
            remoteRooms.map((room) => ({
              id: room.id,
              name: room.name,
              room_type: room.room_type,
              floor_name: room.floor_name
            }))
          );
        } else {
          setRooms([]);
        }
      } else {
        const demoProperty = getDemoActiveProperty();
        setDataMode('demo');
        setHasProperty(Boolean(demoProperty));
        setPropertyNickname(demoProperty?.nickname || 'Your property');
        setRooms(getDemoRooms());
      }

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

  const assetCountsByRoom = useMemo(() => {
    return assets.reduce<Record<string, number>>((acc, asset) => {
      if (!asset.room_id) {
        return acc;
      }

      acc[asset.room_id] = (acc[asset.room_id] || 0) + 1;
      return acc;
    }, {});
  }, [assets]);

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
                ? 'Signed-in mode: property, floors, rooms, utilities, and assets are loaded from Supabase.'
                : 'Demo mode: property, floors, rooms, utilities, and assets are loaded from localStorage.'}
            </p>
            {utilityError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {utilityError}
              </p>
            ) : null}
            {assetError ? (
              <p style={{ marginTop: 8, marginBottom: 0, color: '#b91c1c', fontWeight: 700 }}>
                {assetError}
              </p>
            ) : null}
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
                      type={`${formatEnumLabel(room.room_type)} • ${assetCountsByRoom[room.id] || 0} asset${assetCountsByRoom[room.id] === 1 ? '' : 's'}`}
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
