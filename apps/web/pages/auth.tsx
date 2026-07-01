import { PageHeader, Card } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';

export default function AuthPlaceholder() {
  return (
    <>
      <PageHeader title="Authentication" description="Use the new sign-in and sign-up routes." />
      <Card>
        <p style={{ marginBottom: 16 }}>Auth is now available through dedicated pages.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <ActionLink href="/sign-in">Go to sign in</ActionLink>
          <ActionLink href="/sign-up" variant="secondary">Go to sign up</ActionLink>
        </div>
      </Card>
    </>
  );
}
