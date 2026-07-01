import { useRouter } from 'next/router';
import { PageHeader, Card } from '@home-bible/ui';
import { ActionLink } from '../../../components/ActionLink';

export default function PropertyDashboard() {
  const router = useRouter();
  const { id } = router.query;
  const propertyName = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('demo-property') || '{}').nickname || 'My Property' : 'My Property';
  const mapHref = typeof id === 'string' ? `/property/${id}/map` : '/home-map';

  return (
    <>
      <PageHeader title={propertyName || 'Property Dashboard'} description="Legacy property overview for map and onboarding shortcuts." />
      <Card>
        <div className="space-y-4">
          <p>Property overview - organize your home's information across floors, rooms, and utilities.</p>
          <div className="flex gap-2 flex-wrap">
            <ActionLink href={mapHref}>Home Map</ActionLink>
            <ActionLink href="/add-rooms" variant="secondary">Add rooms</ActionLink>
            <ActionLink href="/settings" variant="secondary">Settings</ActionLink>
          </div>
        </div>
      </Card>
    </>
  );
}
