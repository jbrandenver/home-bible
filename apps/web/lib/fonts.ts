// Self-hosted, non-render-blocking fonts via next/font/google — replaces the
// render-blocking Google Fonts @import that used to chain HTML → globals.css →
// googleapis → gstatic before text could paint. next/font self-hosts the files,
// auto-preloads, sets display:swap, and injects size-adjust fallback metrics to
// cut the swap reflow. See docs/BROWSER_AWARE_DESIGN.md §5.
import { Fraunces, Newsreader, IBM_Plex_Mono } from 'next/font/google';

export const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-mono',
});

/** Combined CSS-variable classNames — apply to a top-level wrapper. */
export const fontVariables = `${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`;
