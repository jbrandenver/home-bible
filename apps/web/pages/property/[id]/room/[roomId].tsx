import { useRouter } from 'next/router';
import Link from 'next/link';
import { PageHeader, Card, Button } from '@home-bible/ui';

export default function RoomDetail() {
  const router = useRouter();
  const { id, roomId } = router.query;

  return (
    <>
      <PageHeader title={`Room ${roomId}`} subtitle="Room details and utilities" />
      <Card>
        <p className="mb-4">Utilities and details for room {roomId}.</p>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Link href={`/property/${id}/map`}>
            <Button variant="secondary">Back to Home Map</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
