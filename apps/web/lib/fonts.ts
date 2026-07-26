// Self-hosted, non-render-blocking fonts via next/font/google — replaces the
// render-blocking Google Fonts @import that used to chain HTML → globals.css →
// googleapis → gstatic before text could paint. next/font self-hosts the files,
// auto-preloads, sets display:swap, and injects size-adjust fallback metrics to
// cut the swap reflow. See docs/BROWSER_AWARE_DESIGN.md §5.
//
// The Register of Record — the three faces of an official document:
//   Cinzel        — inscriptional Roman capitals; the struck title, the
//                   wordmark, seals, and section marks. Engraved, ceremonial,
//                   the face a certificate is titled in. No italic by nature.
//   Spectral      — a document-grade transitional serif for reading; carries
//                   dense Operate copy calmly and has true italics for asides.
//   Overpass Mono — signage/forms mono derived from Highway Gothic; the
//                   machine-readable zone, folio numbers, registry lines, and
//                   data. Reads official rather than editorial or "coder".
import { Cinzel, Spectral, Overpass_Mono } from 'next/font/google';

export const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-cinzel',
});

export const spectral = Spectral({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-spectral',
});

export const overpassMono = Overpass_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-overpass-mono',
});

/** Combined CSS-variable classNames — apply to a top-level wrapper. */
export const fontVariables = `${cinzel.variable} ${spectral.variable} ${overpassMono.variable}`;
