import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card } from '@home-folder/ui';
import { authenticateBiometric, checkBiometry, isNativeApp } from '../lib/native';

export const APP_LOCK_STORAGE_KEY = 'ohf-app-lock';

// How long the app must sit in the background before Face ID is asked for
// again. Short flips to the camera roll or a text shouldn't re-lock.
const RELOCK_AFTER_MS = 30_000;

function appLockEnabled(): boolean {
  try {
    return localStorage.getItem(APP_LOCK_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

// Settings card for the Face ID app lock. Renders nothing outside the iOS
// shell or on devices with no enrolled biometry, so settings.tsx can mount it
// unconditionally. Turning the lock ON requires passing Face ID once — proof
// the sensor works before the user is ever locked out behind it.
export function AppLockSettingsCard() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    void checkBiometry().then((status) => {
      if (status.available) {
        setVisible(true);
        setEnabled(appLockEnabled());
      }
    });
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled) {
        localStorage.setItem(APP_LOCK_STORAGE_KEY, 'off');
        setEnabled(false);
      } else if (await authenticateBiometric('Confirm Face ID to turn on the app lock')) {
        localStorage.setItem(APP_LOCK_STORAGE_KEY, 'on');
        setEnabled(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>App lock</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Ask for Face ID when the app opens or returns after a while away. The lock is per
        device — it protects this phone, not your account.
      </p>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={busy}
          onChange={() => void toggle()}
        />
        <span>{enabled ? 'App lock is on' : 'App lock is off'}</span>
      </label>
    </Card>
  );
}

// iOS-shell chrome: tags <html> with .native-app (CSS hooks for safe areas
// and shell-only tweaks) and enforces the optional Face ID app lock. Renders
// nothing in ordinary browsers.
export function NativeShell() {
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setUnlocking(true);
    const passed = await authenticateBiometric('Unlock your home records');
    setUnlocking(false);
    if (passed) setLocked(false);
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add('native-app');

    if (appLockEnabled()) {
      setLocked(true);
    }

    // The webview fires visibilitychange when the app backgrounds; re-lock
    // only after a real absence so quick app switches stay frictionless.
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      if (
        appLockEnabled() &&
        hiddenAt.current !== null &&
        Date.now() - hiddenAt.current > RELOCK_AFTER_MS
      ) {
        setLocked(true);
      }
      hiddenAt.current = null;
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Prompt as soon as the lock screen appears so the happy path is a single
  // Face ID glance with no tap.
  useEffect(() => {
    if (locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!locked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-page, #fff)',
        padding: 24
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Our Home Folder is locked</h1>
        <p style={{ marginBottom: 16 }}>Unlock with Face ID to open your home records.</p>
        <Button type="button" onClick={() => void unlock()} disabled={unlocking}>
          {unlocking ? 'Unlocking…' : 'Unlock'}
        </Button>
      </div>
    </div>
  );
}
