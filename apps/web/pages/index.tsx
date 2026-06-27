import Link from 'next/link';
import { PageHeader, Card, Button } from '@home-bible/ui';

export default function Home() {
  return (
    <>
      <PageHeader title="Welcome" description="Secure home knowledge for owners and renters" />
      <Card>
        <p className="mb-4">Get started by creating a property or viewing your dashboard.</p>
        <div className="flex gap-2">
          <Link href="/create-property">
            <Button>Create Property</Button>
          </Link>
          <Link href="/sign-in">
            <Button>Sign In</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
