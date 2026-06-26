import { useRouter } from 'next/router';
import Link from 'next/link';
import { PageHeader, Card, Button } from '@home-bible/ui';

export default function PropertyDashboard() {
  const router = useRouter();
  const { id } = router.query;
  const propertyName = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('demo-property') || '{}').nickname || 'My Property' : 'My Property';

  return (
    <>
      <PageHeader title={propertyName || 'Property Dashboard'} description={`ID: ${id ?? 'loading'}`} />
      <Card>
        <div className="space-y-4">
          <p>Property Overview — organize your home's information across floors, rooms, and utilities.</p>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/property/${id}/map`}>
              <Button>Home Map</Button>
            </Link>
            <Link href={`/property/${id}/add-rooms`}>
              <Button>Add Rooms</Button>
            </Link>
            <Link href={`/property/${id}/settings`}>
              <Button>Settings</Button>
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
