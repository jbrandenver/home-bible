/** @type {import('next').NextConfig} */

// Security headers (launch review 2026-07-31). Served by the OpenNext worker
// on every route. HSTS assumes the Cloudflare "Always Use HTTPS" zone toggle
// is on, so no one can get stuck on http.

// CSP (2026-08-03): shipped REPORT-ONLY first — a wrong CSP breaks silently,
// so it observes for a quiet week before the header key drops the suffix
// (tracked in docs/LAUNCH_CHECKLIST.md). The app's real surface is small:
// fonts are self-hosted via next/font, scripts and styles are first-party
// (Next's inline bootstrap and the app's inline styles need 'unsafe-inline'),
// and the only external origin is Supabase (API, auth, storage images).
// Stripe Payment Links are plain navigations, untouched by CSP.
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gdntnlhnjyyzxcjuypuy.supabase.co')
  .replace(/\/$/, '');

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace(/^https:/, 'wss:')}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self'"
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The app is never legitimately framed; blocks clickjacking on auth pages.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Photo capture uses <input capture>, which invokes the native camera app —
  // the browser camera/mic/geolocation APIs are unused and can be shut off.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy }
];

const nextConfig = {
  transpilePackages: ['@home-folder/ui', '@home-folder/shared'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

module.exports = nextConfig;
