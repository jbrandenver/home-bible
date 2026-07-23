import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Layout } from '../components/Layout';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { fontVariables } from '../lib/fonts';

export default function App({ Component, pageProps }: AppProps) {
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
