import Link from 'next/link';
import { useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { Seo } from '../components/Seo';
import { formatAuthError, isSupabaseConfigured, requestPasswordReset } from '../lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const setupMissing = !isSupabaseConfigured();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    const result = await requestPasswordReset(email);

    setLoading(false);

    if (result.error) {
      setError(formatAuthError(result.error));
      return;
    }

    setSent(true);
  };

  return (
    <>
      <Seo title="Forgot password — Our Home Folder" path="/forgot-password" noindex />
      <PageHeader
        title="Forgot password"
        description="We'll email you a link to choose a new one."
      />

      <Card>
        {setupMissing && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(227,194,136,0.14)', border: '1px solid var(--color-brass-pale)', color: 'var(--color-clay)' }}>
            Password reset is not available in this local build.
          </div>
        )}

        {sent ? (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Check your email.</p>
            <p style={{ color: 'var(--text-muted)' }}>
              If an account exists for {email || 'that address'}, a reset link is on its way.
              The link opens a page where you choose a new password.
            </p>
            <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
              Nothing arriving? Check spam, or{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-brass-deep)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              >
                try a different address
              </button>
              .
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
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

            {error ? <p role="alert" style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p> : null}

            <div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Email me a reset link'}
              </Button>
            </div>
          </form>
        )}

        <p style={{ marginTop: 16, marginBottom: 0, color: 'var(--text-muted)' }}>
          Remembered it? <Link href="/sign-in">Sign in</Link>
        </p>
      </Card>
    </>
  );
}
