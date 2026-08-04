import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getCurrentUser } from '../lib/auth';
import { acceptPropertyInvitation } from '../lib/sharing';

export default function AcceptInvitePage() {
  const router = useRouter();
  const queryToken = typeof router.query.token === 'string' ? router.query.token : '';
  // Fallback: read the token straight off the URL. The router's query is
  // empty until hydration finishes, and this link is opened cold from an
  // email — the recipient must never see "missing its code" while it loads.
  const [urlToken, setUrlToken] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrlToken(new URLSearchParams(window.location.search).get('token') || '');
    }
  }, []);

  const token = queryToken || urlToken;
  // Who is here decides what happens: a signed-in visitor accepts right away;
  // a signed-out one gets told what this link is and how to create the
  // account first. Firing the accept blind left signed-out recipients staring
  // at "Accepting invitation..." forever (found in Jesse's launch QA).
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'signed-in'>('checking');
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'failed'>('idle');
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    // If the auth client stalls, fall through to the signed-out screen: its
    // sign-in/sign-up buttons are safe for everyone (a signed-in visitor who
    // clicks sign-in bounces straight back here), whereas an endless spinner
    // is safe for no one.
    const fallback = window.setTimeout(() => {
      if (isMounted) {
        setAuthState((current) => (current === 'checking' ? 'signed-out' : current));
      }
    }, 4000);

    getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setAuthState(user ? 'signed-in' : 'signed-out');
        }
      })
      .catch(() => {
        if (isMounted) {
          setAuthState('signed-out');
        }
      });

    return () => {
      isMounted = false;
      window.clearTimeout(fallback);
    };
  }, []);

  // Joining a property is a state change, so it needs a deliberate click.
  // This used to run automatically on page load, which meant merely visiting
  // the link joined you to the inviter's property — and mail clients, chat
  // unfurlers and link scanners all prefetch URLs, so a signed-in person could
  // be enrolled into a stranger's home without ever seeing this page. That
  // property then appears in their switcher looking trusted, which is a good
  // phishing surface. /claim already requires an explicit action; so does this.
  async function handleAccept() {
    if (!token || status === 'accepting') {
      return;
    }

    setStatus('accepting');
    setError('');

    try {
      const acceptedPropertyId = await acceptPropertyInvitation(token);
      setPropertyId(acceptedPropertyId);
      setStatus('accepted');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Failed to accept invitation.');
      setStatus('failed');
    }
  }

  const nextParam = encodeURIComponent(router.asPath);

  return (
    <>
      <PageHeader
        title="Accept Invitation"
        description="Join a shared Our Home Folder property with the role chosen by the inviter."
      />

      <Card>
        {!token ? (
          authState === 'checking' || !router.isReady ? (
            <p style={{ margin: 0 }}>Checking your invitation...</p>
          ) : (
            <p style={{ margin: 0 }}>
              This invitation link is missing its code. Ask the person who invited you to send
              the link again.
            </p>
          )
        ) : authState === 'checking' ? (
          <p style={{ margin: 0 }}>Checking your invitation...</p>
        ) : authState === 'signed-out' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>
              Someone has shared their home record with you. To open it, you need a free
              Our Home Folder account — your invitation is attached to this link, so
              you&rsquo;ll land right back here after signing up.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionLink href={`/sign-up?next=${nextParam}`}>Create a free account</ActionLink>
              <ActionLink href={`/sign-in?next=${nextParam}`} variant="secondary">
                I already have an account — sign in
              </ActionLink>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
              You&rsquo;ll only see what the inviter chose to share, at the access level they set.
            </p>
          </div>
        ) : status === 'idle' || status === 'accepting' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>
              Someone has invited you to their home record. Accepting adds it to your
              account at the access level they chose, and they will be able to see that
              you joined.
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
              Only accept invitations from people you know. If this is unexpected, close
              this page — nothing happens until you choose to join.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" onClick={handleAccept} disabled={status === 'accepting'}>
                {status === 'accepting' ? 'Joining…' : 'Accept invitation'}
              </Button>
              <ActionLink href="/dashboard" variant="secondary">
                Not now
              </ActionLink>
            </div>
          </div>
        ) : status === 'accepted' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }}>Invitation accepted. You now have access to this shared property.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" onClick={() => router.push('/dashboard')}>Go to dashboard</Button>
              {propertyId ? <Link href="/home-map">Open home map</Link> : null}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p>
            <p style={{ margin: 0 }}>
              The invitation could not be accepted. It may have expired or already been used —
              ask the inviter to send a fresh link. If you signed in with a different email
              than the one that was invited, sign out and use the invited address.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" onClick={handleAccept}>
                Try again
              </Button>
              <ActionLink href="/dashboard" variant="secondary">Go to dashboard</ActionLink>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
