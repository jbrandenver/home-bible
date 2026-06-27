import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';
import {
  getCurrentUser,
  getSupabaseSetupMessage,
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
        description="Account, property, privacy, sharing, billing, export, and deletion controls will live here."
      />

      <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Account</h2>
            {!supabaseReady ? (
              <p style={{ color: '#92400e', margin: 0 }}>{getSupabaseSetupMessage()}</p>
            ) : !isReady ? (
              <p style={{ color: '#6b7280', margin: 0 }}>Loading account…</p>
            ) : user ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <UtilityBadge label={`Signed in as ${user.email || 'unknown user'}`} />
                <div>
                  <Button type="button" onClick={handleSignOut}>
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <p style={{ color: '#6b7280', margin: 0 }}>You are in demo mode.</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link href="/sign-in">
                    <Button type="button">Sign in</Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button type="button">Create account</Button>
                  </Link>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Security and privacy</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label="Account deletion required" />
              <UtilityBadge label="Data export required" />
              <UtilityBadge label="No access codes" />
              <UtilityBadge label="Address optional" />
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Future settings sections</h2>
            <ul style={{ color: '#4b5563', lineHeight: 1.8 }}>
              <li>Account</li>
              <li>Properties</li>
              <li>Plan and billing</li>
              <li>Sharing</li>
              <li>Privacy</li>
              <li>Data export</li>
              <li>Delete account</li>
              <li>Support</li>
            </ul>
          </Card>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button type="button">Back to dashboard</Button>
            </Link>
            <Link href="/home-map">
              <Button type="button">Home map</Button>
            </Link>
          </div>
      </div>
    </>
  );
}
