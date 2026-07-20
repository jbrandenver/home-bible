import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import {
  formatAuthError,
  isSupabaseConfigured,
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail
} from '../lib/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setupMissing = !isSupabaseConfigured();

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    const result = await signUpWithEmail(email, password);

    setLoading(false);

    if (result.error) {
      setError(formatAuthError(result.error));
      return;
    }

    router.push('/dashboard');
  };

  return (
    <>
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
              required
              minLength={8}
            />
          </label>

          {error ? <p style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create account with email'}</Button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setError('');
                const result = await signInWithGoogle();
                if (result.error) {
                  setError(formatAuthError(result.error));
                }
              }}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setError('');
                const result = await signInWithApple();
                if (result.error) {
                  setError(formatAuthError(result.error));
                }
              }}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
            >
              Continue with Apple
            </button>
          </div>
        </form>

        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </Card>
    </>
  );
}
