import Link from 'next/link';
import { PageHeader, Card, Button } from '@home-bible/ui';

export default function AuthPlaceholder() {
  return (
    <>
      <PageHeader title="Authentication" description="Use the new sign-in and sign-up routes." />
      <Card>
        <p style={{ marginBottom: 16 }}>Auth is now available through dedicated pages.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/sign-in">
            <Button type="button">Go to sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button type="button">Go to sign up</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}
