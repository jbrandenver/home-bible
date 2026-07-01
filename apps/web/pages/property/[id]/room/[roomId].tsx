import { useRouter } from 'next/router';
import { PageHeader, Card } from '@home-bible/ui';
import { ActionLink } from '../../../../components/ActionLink';

export default function RoomDetail() {
  const router = useRouter();
  const { id, roomId } = router.query;
  const roomLabel = typeof roomId === 'string' ? roomId : 'room';
  const mapHref = typeof id === 'string' ? `/property/${id}/map` : '/home-map';

  return (
    <>
      <PageHeader title={`Room ${roomLabel}`} description="Room details and utilities" />
      <Card>
        <p className="mb-4">Utilities and details for this room.</p>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <ActionLink href={mapHref} variant="secondary">Back to Home Map</ActionLink>
        </div>
      </Card>
    </>
  );
}
