import '../styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Layout } from '../components/Layout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fontVariables } from '../lib/fonts';

export default function App({ Component, pageProps }: AppProps) {
  // PWA: register the (deliberately conservative) service worker — production
  // only, so dev never fights a cache.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is progressive enhancement — the app works without it */
    });
  }, []);

  return (
    // display:contents so the font-variable wrapper adds no box (no layout
    // impact); the CSS custom properties still cascade to all descendants.
    <div className={fontVariables} style={{ display: 'contents' }}>
      <Layout>
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
      </Layout>
    </div>
  );
}
