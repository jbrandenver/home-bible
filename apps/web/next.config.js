/** @type {import('next').NextConfig} */

// Security headers (launch review 2026-07-31). Served by the OpenNext worker
// on every route. HSTS assumes the Cloudflare "Always Use HTTPS" zone toggle
// is on, so no one can get stuck on http.

// CSP (2026-08-04): now ENFORCING. It shipped report-only intending a quiet
// observation week, but the policy carried no report-uri/report-to, so nothing
// was ever collected — report-only with no collector enforces nothing and
// learns nothing. The 2026-08-04 security audit inventoried the whole client
// surface twice, independently: one inline <script> type (JSON-LD via
// components/Seo.tsx), inline style attributes, self-hosted next/font files, a
// service worker at /sw.js, a manifest, and exactly one external origin
// (Supabase). Nothing in the app violates the policy below, so enforcing it
// changes no behaviour while making the header actually do its job.
//
// Residual risk, stated plainly: script-src keeps 'unsafe-inline' because
// Next's bootstrap needs it, so this does NOT stop an injected inline script.
// Sessions live in localStorage, so an XSS is still account takeover. Closing
// that means noncing the JSON-LD script and dropping 'unsafe-inline' — a
// separate change. This header buys the other directives (object-src,
// base-uri, form-action, frame-ancestors, connect-src egress control), which
// are worth having enforced today.
//
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
  "frame-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests'
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
  { key: 'Content-Security-Policy', value: contentSecurityPolicy }
];

const nextConfig = {
  transpilePackages: ['@home-folder/ui', '@home-folder/shared'],
  // Don't advertise the framework and its version to a scanner.
  poweredByHeader: false,
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
