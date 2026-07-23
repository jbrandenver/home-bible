# Web Analytics (GA4) & Cookie Consent Guide

Production-ready GA4 with **consent-first** loading across **Next.js App Router**
(Drive My Path), **Next.js Pages Router** (Home Bible), and **Vite SPA**
(Workflow Weaver). Companion to `SEO_FUNDAMENTALS.md` (CSP) and
`SECRETS_ENV_SECURITY.md` (key classification).

Based on the official `@next/third-parties/google` integration for Next.js and
`gtag.js` for non-Next apps.

## The one rule that dominates the design

**Analytics must not run until the visitor has consented** (GDPR/ePrivacy in the
EU/UK and a growing list of regions). "Reject" must mean the GA script is never
injected — not that it loads and runs quietly. Everything below is built around
that. An always-on "paste this snippet in `<head>`" GA install is a legal
liability; don't ship one.

**Key classification:** `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `VITE_GA_MEASUREMENT_ID`
is a **publishable** value (it's designed to be in the client bundle) — the
`NEXT_PUBLIC_`/`VITE_` prefix is correct here, unlike a secret (see
`SECRETS_ENV_SECURITY.md`). It still must not fire before consent.

---

## Part A — Next.js App Router (Drive My Path)

### 1. Install

```bash
npm install @next/third-parties@latest
```

### 2. Env

```env
# .env.local (gitignored) and host env — publishable, not a secret
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```
Add the same key (with a placeholder value) to `.env.example`. Use different IDs
per environment.

### 3. Analytics utilities — `lib/analytics.ts`

```ts
import { sendGAEvent } from '@next/third-parties/google'

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ''

/** Enabled only in production with a real ID configured. */
export const isAnalyticsEnabled = (): boolean =>
  process.env.NODE_ENV !== 'development' &&
  Boolean(GA_MEASUREMENT_ID) &&
  GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX'

export interface GAEvent {
  action: string
  category?: string
  label?: string
  value?: number
  params?: Record<string, unknown>
}

export function trackEvent(e: GAEvent): void {
  if (!isAnalyticsEnabled()) return
  sendGAEvent({
    event_name: e.action,
    event_category: e.category ?? 'engagement',
    event_label: e.label,
    value: e.value,
    ...e.params,
  })
}

export interface WebVitalsMetric {
  id: string; name: string; value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number; label?: string
  attribution?: Record<string, unknown>
}

export function reportWebVitals(metric: WebVitalsMetric): void {
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV === 'development') console.info('Web Vitals (dev):', metric)
    return
  }
  if (metric.label !== 'web-vital') return
  // CLS is unitless; scale ×1000 so GA stores a useful integer.
  const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)
  sendGAEvent({
    event_name: 'web_vitals', event_category: 'Web Vitals', event_label: metric.name,
    value, metric_id: metric.id, metric_rating: metric.rating, metric_delta: metric.delta,
  })
}

/** Common trackers — extend per domain (see §Domain extensions). */
export const analytics = {
  trackExternalLink: (url: string, text?: string) =>
    trackEvent({ action: 'click_external_link', label: url, params: { link_text: text, link_url: url } }),
  trackDownload: (filename: string, fileType?: string) =>
    trackEvent({ action: 'download', label: filename, params: { file_name: filename, file_type: fileType } }),
  trackFormSubmission: (formName: string, success = true) =>
    trackEvent({ action: 'form_submission', label: formName, value: success ? 1 : 0, params: { form_name: formName, submission_success: success } }),
  trackSearch: (query: string, results?: number) =>
    trackEvent({ action: 'search', label: query, value: results, params: { search_term: query, search_results: results } }),
}
```

### 4. Consent — default `denied` before anything loads (Consent Mode v2)

```tsx
// app/layout.tsx — <head> sets consent DEFAULT before any tag can run
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="consent-default" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied', analytics_storage: 'denied',
            ad_user_data: 'denied', ad_personalization: 'denied',
            wait_for_update: 500,
          });
        `}</Script>
      </head>
      <body>
        <ConsentProvider>
          {children}
          <GoogleAnalytics />   {/* mounts only after Accept */}
          <WebVitals />         {/* gated on consent too */}
          <CookieConsentBanner />
        </ConsentProvider>
      </body>
    </html>
  )
}
```

### 5. Consent context

```tsx
// components/ConsentProvider.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Consent = 'granted' | 'denied' | 'unknown'
const Ctx = createContext<{ consent: Consent; setConsent: (c: Consent) => void }>({ consent: 'unknown', setConsent: () => {} })
export const useConsent = () => useContext(Ctx)

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setState] = useState<Consent>('unknown') // nothing runs on first paint
  useEffect(() => {
    const saved = localStorage.getItem('analytics-consent')
    if (saved === 'granted' || saved === 'denied') setState(saved)
  }, [])
  const setConsent = (c: Consent) => {
    localStorage.setItem('analytics-consent', c)
    setState(c)
    window.gtag?.('consent', 'update', { analytics_storage: c === 'granted' ? 'granted' : 'denied' })
  }
  return <Ctx.Provider value={{ consent, setConsent }}>{children}</Ctx.Provider>
}
```

### 6. GA + WebVitals gated on consent

```tsx
// components/GoogleAnalytics.tsx
'use client'
import { GoogleAnalytics as NextGA } from '@next/third-parties/google'
import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from '@/lib/analytics'
import { useConsent } from './ConsentProvider'

export default function GoogleAnalytics() {
  const { consent } = useConsent()
  if (!isAnalyticsEnabled() || consent !== 'granted') return null // never injected until Accept
  return <NextGA gaId={GA_MEASUREMENT_ID} />
}
```

```tsx
// components/WebVitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals } from '@/lib/analytics'
import { useConsent } from './ConsentProvider'

export function WebVitals() {
  const { consent } = useConsent()
  useReportWebVitals((metric) => { if (consent === 'granted') reportWebVitals(metric) })
  return null
}
```

### 7. Banner

```tsx
// components/CookieConsentBanner.tsx
'use client'
import { useConsent } from './ConsentProvider'

export function CookieConsentBanner() {
  const { consent, setConsent } = useConsent()
  if (consent !== 'unknown') return null
  return (
    <div role="dialog" aria-label="Cookie consent" className="cookie-banner">
      <p>We use analytics cookies to understand usage. They stay off until you accept.</p>
      <div>
        <button onClick={() => setConsent('denied')}>Reject</button>
        <button onClick={() => setConsent('granted')}>Accept</button>
      </div>
    </div>
  )
}
```

Place `GoogleAnalytics`/`WebVitals` **after** `{children}` so app content
hydrates first (better Core Web Vitals).

---

## Part B — Next.js Pages Router (Home Bible)

Same consent model; wiring differs (no App Router `<head>` component):
- Put the **consent-default** `gtag('consent','default',{…})` snippet in
  `pages/_document.tsx` `<Head>` via `next/script` `beforeInteractive`.
- Wrap `pages/_app.tsx` in `ConsentProvider`; render `GoogleAnalytics` +
  `CookieConsentBanner` there.
- `GoogleAnalytics` uses `@next/third-parties/google` the same way.
- Web Vitals: export `reportWebVitals` from `_app.tsx`
  (`export function reportWebVitals(metric){ … }`) and forward to
  `lib/analytics` only when `consent === 'granted'` (read from a module-level
  store or `localStorage`).

---

## Part C — Vite SPA (Workflow Weaver)

No `@next/third-parties`. Load `gtag.js` dynamically **only after consent**, so
nothing hits Google until Accept.

```ts
// src/lib/analytics.ts
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
let loaded = false

export const analyticsEnabled = () =>
  import.meta.env.PROD && Boolean(GA_ID) && GA_ID !== 'G-XXXXXXXXXX'

/** Inject gtag.js exactly once, only after consent. */
export function loadGA(): void {
  if (loaded || !analyticsEnabled()) return
  loaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
  ;(window as any).dataLayer = (window as any).dataLayer || []
  function gtag(...args: unknown[]) { (window as any).dataLayer.push(args) }
  ;(window as any).gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_ID, { send_page_view: true })
}

export function trackEvent(action: string, params?: Record<string, unknown>) {
  if (!loaded) return
  ;(window as any).gtag?.('event', action, params ?? {})
}
```

```tsx
// src/components/ConsentBanner.tsx
import { useEffect, useState } from 'react'
import { loadGA } from '@/lib/analytics'

type Consent = 'granted' | 'denied' | 'unknown'

export function ConsentBanner() {
  const [consent, setConsent] = useState<Consent>('unknown')
  useEffect(() => {
    const saved = localStorage.getItem('analytics-consent') as Consent | null
    if (saved === 'granted') { setConsent('granted'); loadGA() }     // returning, opted-in
    else if (saved === 'denied') setConsent('denied')
  }, [])
  if (consent !== 'unknown') return null
  const choose = (c: Exclude<Consent, 'unknown'>) => {
    localStorage.setItem('analytics-consent', c)
    setConsent(c)
    if (c === 'granted') loadGA()   // only now does GA load
  }
  return (
    <div role="dialog" aria-label="Cookie consent" className="cookie-banner">
      <p>We use analytics cookies to understand usage. They stay off until you accept.</p>
      <button onClick={() => choose('denied')}>Reject</button>
      <button onClick={() => choose('granted')}>Accept</button>
    </div>
  )
}
```

For SPA route-change pageviews, call
`gtag('event','page_view',{ page_location: location.href })` on route change
(only after `loadGA()`), since a manual gtag config sends the initial view only.

---

## CSP

Allow Google domains — see the full directive list and the **security tradeoff**
of `'unsafe-inline'`/`'unsafe-eval'` in `SEO_FUNDAMENTALS.md` (the consent-gated
approach here doesn't change the CSP requirements). Wildcard Google subdomains.

## Domain extensions

Extend the tracker object per app (e-commerce, POS, etc.) — same `trackEvent`
shape:

```ts
// e-commerce
trackProductView: (id: string, name: string, price: number) =>
  trackEvent({ action: 'view_item', label: name, value: price, params: { product_id: id, price } }),
trackPurchase: (orderId: string, total: number, items: number) =>
  trackEvent({ action: 'purchase', label: orderId, value: total, params: { order_id: orderId, item_count: items } }),
```

## Metrics reference

GA4 Web Vitals: **LCP, INP, CLS** (Core), plus **FCP, TTFB**. **FID is
deprecated — INP replaced it as a Core Web Vital in March 2024**; don't build
new reporting around FID. Next.js also emits `Next.js-hydration`,
`Next.js-route-change-to-render`, `Next.js-render`.

## Testing

- **Dev:** analytics disabled. DevTools → Network filtered to
  `google-analytics`/`gtag` shows **zero** requests. Web Vitals log to console.
- **Consent — the critical test:** on a fresh production load, before choosing,
  Network shows **no** `googletagmanager.com`/`google-analytics.com` requests.
  Click **Reject** → still zero, banner hidden, choice persists across reloads.
  Click **Accept** → GA loads, beacons fire, Consent Mode flips
  `analytics_storage: granted`.
- **GA4 dashboard:** Reports → Realtime shows active users; use **DebugView**
  (with the GA Debugger extension) for the live event stream.

## Checklist

- [ ] Measurement ID in env as a **publishable** var; `.env.example` updated
- [ ] Consent default = `denied` set before any tag (Consent Mode v2)
- [ ] GA **and** Web Vitals mount only after `consent === 'granted'`
- [ ] Reject → verified zero Google requests in DevTools; choice persists
- [ ] A "Cookie settings" affordance lets users change their mind (reset to `unknown`)
- [ ] Analytics off in development
- [ ] CSP allows Google domains; `'unsafe-inline'` tradeoff understood (→ fundamentals)
- [ ] Events fire in GA4 Realtime/DebugView after Accept
