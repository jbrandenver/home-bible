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
  // Dev only: webpack's dev runtime is eval-based; without 'unsafe-eval' the
  // blocked eval throws during hydration and React clears the SSR DOM to a
  // blank page (reliably in WebKit — the iOS shell and simulator Safari).
  // Production stays eval-free.
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
  // Production only: on the http dev server this directive rewrites every
  // subresource to https://localhost, which nothing serves. Desktop browsers
  // exempt localhost as a trustworthy origin; WKWebView (the iOS shell in
  // local verification) does not, and renders a blank page.
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : [])
].join('; ');

const securityHeaders = [
  // Production only: HSTS served from the http dev server teaches WKWebView
  // (iOS shell local verification) that localhost requires https, blanking
  // every subsequent dev load. Desktop browsers ignore HSTS on localhost.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The app is never legitimately framed; blocks clickjacking on auth pages.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Photo capture uses <input capture>, which invokes the native camera app —
  // the browser camera/mic/geolocation APIs are unused and can be shut off.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy }
];

// Stripe Payment Links (live mode, created 2026-08-03). These are PUBLIC
// values — they render into anchor hrefs on /pricing, /pro, and Settings —
// so they live in source rather than as host secrets. They moved here from
// a tracked apps/web/.env.production because the security audit forbids
// tracked non-example env files. Each link carries product_key metadata the
// stripe-webhook function keys off. Inlined at build time (NEXT_PUBLIC_*);
// a host env var or local env file overrides; a redeploy picks up changes.
const stripePaymentLinks = {
  NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK:
    process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_PAYMENT_LINK ||
    'https://buy.stripe.com/7sY28s9L2dFM0G331b6Zy00',
  NEXT_PUBLIC_STRIPE_PER_HOME_PAYMENT_LINK:
    process.env.NEXT_PUBLIC_STRIPE_PER_HOME_PAYMENT_LINK ||
    'https://buy.stripe.com/4gMeVee1i59gbkH1X76Zy01',
  NEXT_PUBLIC_STRIPE_PRO_BINDER_PAYMENT_LINK:
    process.env.NEXT_PUBLIC_STRIPE_PRO_BINDER_PAYMENT_LINK ||
    'https://buy.stripe.com/5kQcN62iAfNUewTdFP6Zy02',
};

const nextConfig = {
  env: { ...stripePaymentLinks },
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
