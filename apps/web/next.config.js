/** @type {import('next').NextConfig} */

// Security headers (launch review 2026-07-31). Served by the OpenNext worker
// on every route. CSP is deliberately absent for now — a wrong CSP breaks the
// app silently, so it lands post-launch as report-only first (tracked in
// docs/LAUNCH_CHECKLIST.md). HSTS assumes the Cloudflare "Always Use HTTPS"
// zone toggle is on, so no one can get stuck on http.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // The app is never legitimately framed; blocks clickjacking on auth pages.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Photo capture uses <input capture>, which invokes the native camera app —
  // the browser camera/mic/geolocation APIs are unused and can be shut off.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
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
