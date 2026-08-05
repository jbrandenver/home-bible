import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Our Home Folder iOS shell.
 *
 * Remote-URL mode: the shell loads the production site and Capacitor injects
 * the native bridge into it, so camera / push / Face ID plugins are callable
 * from the deployed web app (window.Capacitor). The web app detects the shell
 * via lib/native.ts and adapts (no purchase CTAs, native camera, app lock).
 *
 * Account-based app ruling (2026-08-05): no purchase flow in this shell.
 */
const config: CapacitorConfig = {
  appId: 'com.jbranllc.ourhomefolder',
  appName: 'Our Home Folder',
  webDir: 'shell',
  server: {
    url: 'https://ourhomefolder.com',
    // Supabase auth redirects stay inside the shell; everything else
    // (Stripe, external links) must go through @capacitor/browser.
    allowNavigation: ['ourhomefolder.com', '*.ourhomefolder.com', '*.supabase.co'],
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'ourhomefolder',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
