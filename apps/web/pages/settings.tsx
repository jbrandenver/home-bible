import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';
import {
  getCurrentUser,
  isSupabaseConfigured,
  onAuthStateChange,
  signOut
} from '../lib/auth';

export default function SettingsPage() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((currentUser) => {
      if (!isMounted) {
        return;
      }

      setUser(currentUser);
      setIsReady(true);
    });

    const unsubscribe = onAuthStateChange((nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Privacy, account, and safe testing controls for Home & Everything."
      />

      <div style={{ display: 'grid', gap: 24 }}>
          <Card tone="dark">
            <h2 style={{ marginTop: 0 }}>Home & Everything</h2>
            <p style={{ color: 'rgba(255,248,234,0.78)', marginBottom: 0 }}>
              A home, documented. Keep the record calm, private, and complete enough to hand on.
            </p>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Account</h2>
            {!supabaseReady ? (
              <p style={{ color: 'var(--status-attention)', margin: 0 }}>
                Account saving is not available in this local build. Demo data stays only in this browser.
              </p>
            ) : !isReady ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading account...</p>
            ) : user ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <UtilityBadge label={`Signed in as ${user.email || 'account'}`} />
                <div>
                  <Button type="button" onClick={handleSignOut} variant="secondary">
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Demo data is stored only in this browser.</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <ActionLink href="/sign-in">Sign in</ActionLink>
                  <ActionLink href="/sign-up" variant="secondary">Create account</ActionLink>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Security and privacy</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label="Private home record" />
              <UtilityBadge label="No sensitive access details" />
              <UtilityBadge label="Address optional" />
              <UtilityBadge label="Browser-only handover reports" />
              <UtilityBadge label="No public link is created" />
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              Saved home data belongs in your account when you are signed in. In demo mode, it is stored only in this browser.
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Do not store access codes, lock codes, garage codes, safe codes, alarm codes, Wi-Fi passwords, hidden key locations, or other sensitive entry details.
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Home Handover reports are generated in the browser from existing saved data. No public link is created, no invitation is sent, and no generated report file is stored.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionLink href="/handover" variant="secondary">Open handover builder</ActionLink>
              <ActionLink href="/sharing" variant="secondary">Open sharing review</ActionLink>
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Planned settings</h2>
            <ul style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <li>Account</li>
              <li>Properties</li>
              <li>Sharing controls</li>
              <li>Privacy</li>
              <li>Data export</li>
              <li>Delete account</li>
              <li>Support</li>
            </ul>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Development tools</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Private testing tools are kept here so they do not look like normal homeowner destinations.
            </p>
            <ActionLink href="/mvp-test" variant="secondary">Open private MVP test checklist</ActionLink>
          </Card>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink href="/dashboard" variant="secondary">Back to dashboard</ActionLink>
            <ActionLink href="/home-map" variant="secondary">Home map</ActionLink>
          </div>
      </div>
    </>
  );
}
