import { PageHeader, Card, FloorSection, RoomCard, Button } from '@home-bible/ui';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function HomeMap() {
  const { query } = useRouter();
  const id = query.id as string | undefined;

  // Local mock floors/rooms for phase 1
  const floors = [
    { id: 'f1', name: 'Ground Floor', rooms: [{ id: 'r1', name: 'Living Room' }, { id: 'r2', name: 'Kitchen' }] },
    { id: 'f2', name: 'Second Floor', rooms: [{ id: 'r3', name: 'Master Bedroom' }] }
  ];

  return (
    <>
      <PageHeader title="Home Map" description="Organize floors, rooms, and utilities" />
      <Card>
        {floors.length > 0 ? (
          floors.map((floor) => (
            <FloorSection key={floor.id} title={floor.name}>
              <div className="grid grid-cols-2 gap-2">
                {floor.rooms.map((r) => (
                  <Link key={r.id} href={`/property/${id}/room/${r.id}`}>
                    <RoomCard name={r.name} type="Room" />
                  </Link>
                ))}
              </div>
            </FloorSection>
          ))
        ) : (
          <p>No floors or rooms yet. Add them from the dashboard.</p>
        )}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Link href={`/property/${id}`}>
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
