import '../styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Layout } from '../components/Layout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NativeShell } from '../components/NativeShell';
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

  // Safari's back/forward cache revives a full snapshot of the page —
  // including React state from the earlier visit — so for a moment the user
  // sees minutes-old content (launch QA: a long-finished transfer message
  // reappeared). A record app must never show a stale record: when a page is
  // revived from that snapshot, reload it fresh.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return (
    // display:contents so the font-variable wrapper adds no box (no layout
    // impact); the CSS custom properties still cascade to all descendants.
    <div className={fontVariables} style={{ display: 'contents' }}>
      <NativeShell />
      <Layout>
        <ErrorBoundary>
          <Component {...pageProps} />
        </ErrorBoundary>
      </Layout>
    </div>
  );
}
