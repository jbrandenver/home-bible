import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { Seo } from '../components/Seo';
import { formatAuthError, getCurrentUser, isSupabaseConfigured, updatePassword } from '../lib/auth';

// Landing page for the emailed recovery link. Supabase opens this page with a
// recovery session already established (via the link's token), so all that's
// left is choosing the new password. Arriving with no session at all means the
// link expired or was already used.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'missing'>('checking');

  const setupMissing = !isSupabaseConfigured();

  useEffect(() => {
    if (setupMissing) {
      setSessionState('missing');
      return;
    }

    let isMounted = true;
    // The recovery token in the URL hash is processed by the Supabase client
    // shortly after load; poll briefly rather than failing on first check.
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const user = await getCurrentUser();
        if (!isMounted) return;
        if (user) {
          setSessionState('ready');
          window.clearInterval(timer);
          return;
        }
      } catch {
        // Keep polling until attempts run out.
      }
      if (attempts >= 8 && isMounted) {
        setSessionState('missing');
        window.clearInterval(timer);
      }
    }, 500);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [setupMissing]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setError('');
    setSaving(true);

    const result = await updatePassword(password);

    setSaving(false);

    if (result.error) {
      setError(formatAuthError(result.error));
      return;
    }

    router.push('/dashboard');
  };

  return (
    <>
      <Seo title="Choose a new password — Our Home Folder" path="/reset-password" noindex />
      <PageHeader title="Choose a new password" description="Your record stays exactly as you left it." />

      <Card>
        {sessionState === 'checking' ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Checking your reset link…</p>
        ) : sessionState === 'missing' ? (
          <>
            <p style={{ marginTop: 0, fontWeight: 600 }}>This reset link has expired or was already used.</p>
            <p style={{ marginBottom: 0, color: 'var(--text-muted)' }}>
              Request a fresh one from the <Link href="/forgot-password">forgot password</Link> page.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 460 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>New password</span>
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

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                required
                minLength={8}
              />
            </label>

            {error ? <p role="alert" style={{ color: 'var(--status-urgent)', margin: 0 }}>{error}</p> : null}

            <div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save new password'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}
