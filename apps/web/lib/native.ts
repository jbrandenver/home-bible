import { useEffect, useState } from 'react';

// Bridge to the Our Home Folder iOS shell (apps/mobile, Capacitor remote-URL
// mode). The shell loads the production site and injects window.Capacitor, so
// everything here must degrade to a no-op in ordinary browsers and during SSR.
// Deliberately dependency-free: pulling @capacitor/* into the web bundle would
// tax every browser user for a bridge only the shell provides.

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Browser?: { open: (options: { url: string }) => Promise<void> };
    SignInWithApple?: {
      authorize: (options: {
        clientId: string;
        redirectURI: string;
        scopes: string;
        state: string;
        nonce: string;
      }) => Promise<{ response: { identityToken: string } }>;
    };
    BiometricAuthNative?: {
      checkBiometry: () => Promise<{ isAvailable: boolean; biometryType: number }>;
      internalAuthenticate: (options: { reason: string }) => Promise<void>;
    };
    PushNotifications?: {
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
    };
  };
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

function bridge(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null;
  return window.Capacitor ?? null;
}

export function isNativeApp(): boolean {
  return Boolean(bridge()?.isNativePlatform?.());
}

// SSR renders for the open web, so the first client paint must match it:
// start false, flip after mount. Purchase CTAs therefore render server-side
// (good for SEO) and are removed in the shell before the user can interact.
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
  }, []);
  return native;
}

// External destinations (Stripe, partner sites, mailto fallbacks) must leave
// the shell — Apple rejects apps that wrap third-party checkout in the
// webview, and the account-based ruling means no purchase flow in-app at all.
export async function openExternal(url: string): Promise<void> {
  const browser = bridge()?.Plugins?.Browser;
  if (browser) {
    await browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// The shell's bundle identifier — Supabase must list it under the Apple
// provider's "Authorized Client IDs" for signInWithIdToken to accept tokens.
export const IOS_BUNDLE_ID = 'com.jbranllc.ourhomefolder';

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Native Sign in with Apple (ASAuthorizationController sheet). Apple receives
// the SHA-256 of the nonce; Supabase verifies the raw nonce against the hash
// embedded in the identity token, which is why both travel back together.
// Returns null outside the shell or when the user cancels the sheet — callers
// treat null as "nothing happened", not an error.
export async function nativeAppleAuthorize(): Promise<{
  identityToken: string;
  rawNonce: string;
} | null> {
  const plugin = bridge()?.Plugins?.SignInWithApple;
  if (!plugin) return null;
  const rawNonce = randomHex(16);
  try {
    const { response } = await plugin.authorize({
      clientId: IOS_BUNDLE_ID,
      redirectURI: 'https://ourhomefolder.com/dashboard',
      scopes: 'email name',
      state: randomHex(8),
      nonce: await sha256Hex(rawNonce)
    });
    if (!response.identityToken) return null;
    return { identityToken: response.identityToken, rawNonce };
  } catch {
    return null;
  }
}

export interface BiometryStatus {
  available: boolean;
}

export async function checkBiometry(): Promise<BiometryStatus> {
  const plugin = bridge()?.Plugins?.BiometricAuthNative;
  if (!plugin) return { available: false };
  try {
    const result = await plugin.checkBiometry();
    return { available: result.isAvailable };
  } catch {
    return { available: false };
  }
}

// Resolves true when the user passes Face ID / Touch ID / passcode, false on
// cancel or failure. Callers treat false as "stay locked", never as an error.
export async function authenticateBiometric(reason: string): Promise<boolean> {
  const plugin = bridge()?.Plugins?.BiometricAuthNative;
  if (!plugin) return false;
  try {
    await plugin.internalAuthenticate({ reason });
    return true;
  } catch {
    return false;
  }
}

export async function registerForPush(): Promise<boolean> {
  const plugin = bridge()?.Plugins?.PushNotifications;
  if (!plugin) return false;
  try {
    const permission = await plugin.requestPermissions();
    if (permission.receive !== 'granted') return false;
    await plugin.register();
    return true;
  } catch {
    return false;
  }
}
