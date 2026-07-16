import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { acceptPropertyInvitation } from '../lib/sharing';

export default function AcceptInvitePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'failed'>('idle');
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady || !token || status !== 'idle') {
      return;
    }

    let isMounted = true;

    async function acceptInvite() {
      setStatus('accepting');
      setError('');

      try {
        const acceptedPropertyId = await acceptPropertyInvitation(token);
        if (isMounted) {
          setPropertyId(acceptedPropertyId);
          setStatus('accepted');
        }
      } catch (acceptError) {
        if (isMounted) {
          setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept invitation.');
          setStatus('failed');
        }
      }
    }

    acceptInvite();

    return () => {
      isMounted = false;
    };
  }, [router.isReady, status, token]);

  return (
    <>
      <PageHeader
        title="Accept Invitation"
        description="Join a shared Our Home Folder property with the role chosen by the inviter."
      />

      <Card>
        {!token ? <p>This invitation link is missing its token.</p> : null}
        {status === 'idle' || status === 'accepting' ? <p>Accepting invitation...</p> : null}

        {status === 'accepted' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>Invitation accepted. You now have access to this shared property.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => router.push('/dashboard')}>Go to dashboard</Button>
              {propertyId ? <Link href="/home-map">Open home map</Link> : null}
            </div>
          </div>
        ) : null}

        {status === 'failed' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p>
            <p style={{ margin: 0 }}>
              If you are not signed in yet, sign in first and then reopen the invite link.
            </p>
            <Link href={`/sign-in?next=${encodeURIComponent(router.asPath)}`}>Sign in</Link>
          </div>
        ) : null}
      </Card>
    </>
  );
}
