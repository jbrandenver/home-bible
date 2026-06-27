import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Button, Card, PageHeader } from '@home-bible/ui';
import {
  getSupabaseSetupMessage,
  isSupabaseConfigured,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle
} from '../lib/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setupMissing = !isSupabaseConfigured();

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInWithEmail(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <>
      <PageHeader
        title="Sign in"
        description="Sign in to save your core onboarding data to Supabase."
      />

      <Card>
        {setupMissing && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412' }}>
            {getSupabaseSetupMessage()}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              required
            />
          </label>

          {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type="submit">{loading ? 'Signing in...' : 'Sign in with email'}</Button>
            <button
              type="button"
              onClick={async () => {
                setError('');
                const result = await signInWithGoogle();
                if (result.error) {
                  setError(result.error.message);
                }
              }}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={async () => {
                setError('');
                const result = await signInWithApple();
                if (result.error) {
                  setError(result.error.message);
                }
              }}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
            >
              Continue with Apple
            </button>
          </div>
        </form>

        <p style={{ marginTop: 16, color: '#6b7280' }}>
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </Card>
    </>
  );
}
