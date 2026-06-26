import Link from 'next/link';
import { PageHeader, Card, Button } from '@home-bible/ui';

export default function Home() {
  return (
    <>
      <PageHeader title="Welcome" subtitle="Secure home knowledge for owners and renters" />
      <Card>
        <p className="mb-4">Get started by creating a property or viewing your dashboard.</p>
        <div className="flex gap-2">
          <Link href="/create-property">
            <Button variant="primary">Create Property</Button>
          </Link>
          <Link href="/auth">
            <Button variant="secondary">Sign In</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
