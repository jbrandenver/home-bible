import Link from 'next/link';
import { useRouter } from 'next/router';
import { safeRelativePath } from '@home-folder/shared';
import { useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { Seo } from '../components/Seo';
import {
  enabledOAuthProviders,
  formatAuthError,
  isSupabaseConfigured,
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail
} from '../lib/auth';
import { useIsNativeApp } from '../lib/native';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState('');

  const setupMissing = !isSupabaseConfigured();
  // Same shell rule as sign-in: Google refuses OAuth inside embedded
  // webviews, so its button is hidden in the iOS app; Apple and email remain.
  const nativeApp = useIsNativeApp();
  const oauthProviders = enabledOAuthProviders().filter(
    (provider) => !(nativeApp && provider === 'google')
  );

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    // Honour a ?next= destination (e.g. a transfer recipient sent here from
    // /claim keeps their claim code); same open-redirect guard as sign-in.
    // It doubles as the confirmation link's landing page, so the detour
    // through the inbox does not cost them their place.
    const destination = safeRelativePath(router.query.next, '/welcome');
    const result = await signUpWithEmail(email, password, destination);

    setLoading(false);

    if (result.error) {
      setError(formatAuthError(result.error));
      return;
    }

    // Email confirmation is on: there is no session yet, so routing into the
    // app would bounce off the auth guard and strand them with no idea an
    // email is waiting. Tell them instead.
    if (result.needsEmailConfirmation) {
      setConfirmationSentTo(email);
      return;
    }

    router.push(destination);
  };

  if (confirmationSentTo) {
    return (
      <>
        <Seo title="Confirm your email — Our Home Folder" path="/sign-up" />
        <PageHeader
          title="Check your email"
          description="One click and your home record is yours."
        />
        <Card>
          <p style={{ marginTop: 0 }}>
            We sent a confirmation link to <strong>{confirmationSentTo}</strong>.
            Open it and you will land straight back here, signed in.
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            Nothing yet? Give it a minute, then check the spam folder — the mail
            comes from <strong>ourhomefolder.com</strong>. You can close this
            page; the link keeps working.
          </p>
          <p style={{ marginBottom: 0 }}>
            Already confirmed? <Link href="/sign-in">Sign in</Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <Seo title="Create account — Our Home Folder" path="/sign-up" />
      <PageHeader
        title="Create account"
        description="Create an account to keep your home record private and saved."
      />

      <Card>
        {setupMissing && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(227,194,136,0.14)', border: '1px solid var(--color-brass-pale)', color: 'var(--color-clay)' }}>
            Account creation is not available in this local build. You can still use demo mode in this browser.
          </div>
        )}

        <form onSubmit={handleSignUp} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
              required
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
              required
              minLength={8}
            />
          </label>

          {error ? <p role="alert" style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account with email'}</Button>
            {oauthProviders.includes('google') ? (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  // Signing up goes through first-run setup, exactly like the
                  // email path above. Without this the provider sent people
                  // straight to the dashboard and they never saw the wizard.
                  const result = await signInWithGoogle(
                    safeRelativePath(router.query.next, '/welcome')
                  );
                  if (result.error) {
                    setError(formatAuthError(result.error));
                  }
                }}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
              >
                Continue with Google
              </button>
            ) : null}
            {oauthProviders.includes('apple') ? (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  const result = await signInWithApple(
                    safeRelativePath(router.query.next, '/welcome')
                  );
                  if (result.error) {
                    setError(formatAuthError(result.error));
                    return;
                  }
                  // Native sheet resolves in place with a session (Apple
                  // accounts need no email confirmation); web OAuth redirects
                  // on its own. Cancelled sheet: both null, stay put.
                  if (result.data) {
                    router.push(safeRelativePath(router.query.next, '/welcome'));
                  }
                }}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #000', background: '#000', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
              >
                Continue with Apple
              </button>
            ) : null}
          </div>
        </form>

        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </Card>
    </>
  );
}
