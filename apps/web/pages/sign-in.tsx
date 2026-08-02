import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { safeRelativePath } from '@home-folder/shared';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { Seo } from '../components/Seo';
import {
  enabledOAuthProviders,
  formatAuthError,
  isSupabaseConfigured,
  signInWithEmail,
  signInWithGoogle
} from '../lib/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<'google' | null>(null);

  const setupMissing = !isSupabaseConfigured();
  const oauthProviders = enabledOAuthProviders();
  // Never redirect anywhere but back into this app — an attacker-supplied
  // `?next=` would otherwise be an open redirect and a `javascript:` sink.
  const nextPath = safeRelativePath(router.query.next, '/dashboard');

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    const result = await signInWithEmail(email, password);

    setLoading(false);

    if (result.error) {
      setError(formatAuthError(result.error));
      return;
    }

    router.push(nextPath);
  };

  const handleOAuthSignIn = async (provider: 'google') => {
    if (loading || oauthProvider) return;

    setError('');
    setOauthProvider(provider);

    const result = await signInWithGoogle();
    if (result.error) {
      setError(formatAuthError(result.error));
      setOauthProvider(null);
    }
  };

  return (
    <>
      <Seo title="Sign in — Our Home Folder" path="/sign-in" />
      <PageHeader
        title="Sign in"
        description="Sign in to keep your home record saved to your account."
      />

      <Card>
        {setupMissing && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(227,194,136,0.14)', border: '1px solid var(--color-brass-pale)', color: 'var(--color-clay)' }}>
            Account sign-in is not available in this local build. You can still use demo mode in this browser.
          </div>
        )}

        <form onSubmit={handleEmailSignIn} style={{ display: 'grid', gap: 12 }}>
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
              required
            />
          </label>

          {error ? <p role="alert" style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in with email'}</Button>
            {oauthProviders.includes('google') ? (
              <button
                type="button"
                disabled={loading || Boolean(oauthProvider)}
                onClick={() => handleOAuthSignIn('google')}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', cursor: loading || oauthProvider ? 'not-allowed' : 'pointer', opacity: loading || oauthProvider ? 0.65 : 1 }}
              >
                {oauthProvider === 'google' ? 'Redirecting...' : 'Continue with Google'}
              </button>
            ) : null}
          </div>
        </form>

        <p style={{ marginTop: 16, marginBottom: 0, color: 'var(--text-muted)' }}>
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </Card>
    </>
  );
}
