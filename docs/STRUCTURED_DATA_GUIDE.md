# JSON-LD Structured Data Guide

Implementation reference for Google Rich Results across **React + Vite** and
**Next.js**. Companion to `SEO_FUNDAMENTALS.md`, `SEO_CRAWLABILITY_PLAYBOOK.md`,
and `WEB_ANALYTICS_GUIDE.md`. Source: [Google Search Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

---

## 0. Security first: never inject unescaped data into a `<script>`

JSON-LD ships inside `<script type="application/ld+json">`. Both common patterns
put a stringified object into that tag:
- Next.js: `dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}`
- Vite/Helmet: `<script type="application/ld+json">{JSON.stringify(schema)}</script>`

**`JSON.stringify` alone is NOT safe.** If any value in the schema is dynamic —
a course name from Supabase, an FAQ answer from a CMS, a product title, anything
a user or editor can influence — a value containing `</script>` (or a raw
U+2028/U+2029) **breaks out of the script tag and becomes executable HTML**.
That is stored XSS, delivered through your SEO markup. "Safe because it's static
and developer-controlled" is true only until the day someone wires in real data
— and that day always comes.

**Always serialize through this helper** (mirrors the `escapeForScript` rule in
the crawlability playbook, and the sanitization philosophy in
`FORM_VALIDATION_SECURITY.md` — escape at the output boundary):

```ts
// src/lib/json-ld.ts  (works in Vite and Next; no deps)
/**
 * Serialize a JSON-LD object for safe embedding inside a <script> tag.
 * Escapes the characters that can terminate the tag or break the JS string:
 *   <  >  &   →  < > &   (prevents </script> breakout)
 *   U+2028 / U+2029                     (raw line terminators in JS strings)
 * Use this for EVERY JSON-LD block — static or dynamic. It costs nothing and
 * removes the "is this data really static?" judgment call.
 */
export function toJsonLd(schema: object | object[]): string {
  const payload = Array.isArray(schema)
    ? { '@context': 'https://schema.org', '@graph': schema.map(stripContext) }
    : schema;
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function stripContext(item: object): object {
  const { ['@context']: _drop, ...rest } = item as Record<string, unknown>;
  return rest;
}
```

Everything below uses `toJsonLd()`. Additionally: sanitize/length-cap the
underlying data at input (per `FORM_VALIDATION_SECURITY.md`), and don't rely on
CSP alone — `'unsafe-inline'` (often present for GTM) means CSP will NOT catch a
JSON-LD breakout.

---

## 1. Platform patterns

### React + Vite (SPA) via react-helmet-async

```tsx
// src/components/SEO.tsx
import { Helmet } from 'react-helmet-async'
import { toJsonLd } from '@/lib/json-ld'

interface SEOProps {
  title?: string
  description?: string
  canonicalUrl?: string
  ogImage?: string
  ogType?: 'website' | 'article'
  structuredData?: object | object[]   // array → @graph
  noIndex?: boolean
}

const BASE_URL = 'https://www.example.com'

export function SEO({ title, description, structuredData, canonicalUrl, ogImage, noIndex }: SEOProps) {
  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {structuredData && (
        <script type="application/ld+json">{toJsonLd(structuredData)}</script>
      )}
    </Helmet>
  )
}
```

> Helmet injects JSON-LD **client-side**. Google renders JS SPAs, so it works —
> but non-JS crawlers and link-preview bots won't see it. For reliability,
> **prerender** the SPA so the JSON-LD is in the initial HTML (→
> `SEO_CRAWLABILITY_PLAYBOOK.md`). Workflow Weaver has no Helmet yet; add
> `react-helmet-async` + this `<SEO>` component as part of that work.

### Next.js App Router (Drive My Path) — server-rendered

```tsx
// src/components/structured-data.tsx
import { toJsonLd } from '@/lib/json-ld'

export function JsonLd({ schema }: { schema: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // Safe: toJsonLd() escapes </script> / line-terminator breakout. Never
      // pass a raw JSON.stringify here.
      dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }}
    />
  )
}
```

```tsx
// src/app/layout.tsx — global schemas on every page
import { JsonLd } from '@/components/structured-data'
import { organizationSchema, websiteSchema } from '@/lib/schemas'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd schema={[organizationSchema, websiteSchema]} />
        {children}
      </body>
    </html>
  )
}
```

```tsx
// src/app/faq/page.tsx — page-specific schema
import { JsonLd } from '@/components/structured-data'
import { buildFAQSchema } from '@/lib/schemas'

export const metadata = { title: 'FAQ', description: '...' }

export default function FAQPage() {
  const faqSchema = buildFAQSchema([/* {question, answer} from your data */])
  return (<><JsonLd schema={faqSchema} />{/* content */}</>)
}
```

### Next.js Pages Router (Home Bible) — via `next/head`

```tsx
// pages/some-page.tsx
import Head from 'next/head'
import { toJsonLd } from '@/lib/json-ld'

export default function SomePage({ schema }: { schema: object }) {
  return (
    <>
      <Head>
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(schema) }} />
      </Head>
      {/* content */}
    </>
  )
}
// Provide `schema` from getStaticProps/getServerSideProps so it's in the SSR'd HTML.
```

### Platform summary

| Concern | Vite SPA | Next App Router | Next Pages Router |
|---|---|---|---|
| Injection | Helmet + `toJsonLd` | `<JsonLd>` server component | `next/head` + `toJsonLd` |
| Rendering | Client (prerender for reliability) | Server (in HTML) | Server (in HTML) |
| Global schemas | `<SEO>`/wrapper | `layout.tsx` | `_app.tsx` or per-page |
| Multiple schemas | array → `@graph` | `<JsonLd schema={[...]} />` | array → `@graph` |

---

## 2. Which schema for which project type

| Schema | Marketing | Web app / SaaS | Blog/content | Portfolio | E-commerce |
|---|---|---|---|---|---|
| Organization | Required | Required | Required | Required | Required |
| WebSite | Recommended | Recommended | Recommended | Recommended | Recommended |
| BreadcrumbList | Recommended | Optional | Recommended | Recommended | Recommended |
| FAQPage | If FAQ | If FAQ | — | — | If FAQ |
| LocalBusiness | If physical | — | — | — | If physical |
| Article | If blog | — | Required | — | — |
| Event | If events | — | — | If speaking | — |
| VideoObject | If video | If video | If video | — | — |
| SoftwareApplication | — | Required | — | — | — |
| Course / ItemList | — | If LMS | — | — | — |
| ProfilePage | — | — | Author pages | Homepage | — |
| Product | — | Pricing | — | — | Required |

For Jesse's stack: **Workflow Weaver / Drive My Path** → Organization + WebSite +
SoftwareApplication (+ Breadcrumb on inner pages). **Content Desk / marketing**
→ Organization + WebSite + Article. Add FAQPage wherever a real FAQ exists.

---

## 3. Organization (homepage or About; every project)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Example Co",
  "legalName": "Example Company Ltd",
  "url": "https://www.example.com",
  "logo": "https://www.example.com/logo.png",
  "description": "What the organisation does, in one factual sentence.",
  "email": "hello@example.com",
  "foundingDate": "2023",
  "founder": { "@type": "Person", "name": "Jane Doe" },
  "address": { "@type": "PostalAddress", "addressCountry": "US" },
  "areaServed": ["US", "GB", "AU", "CA"],
  "sameAs": ["https://www.linkedin.com/company/example", "https://www.tiktok.com/@example"],
  "contactPoint": { "@type": "ContactPoint", "contactType": "sales", "url": "https://www.example.com/contact" }
}
```

Logo must be crawlable, ≥112×112, indexable. Use the most specific subtype where
it fits (LocalBusiness, OnlineStore). Allow days for Google to recrawl.

## 4. WebSite (homepage; powers the sitelinks search box)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Example Co",
  "url": "https://www.example.com",
  "inLanguage": "en-US",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.example.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

Only include `SearchAction` if site search actually works. `inLanguage` should
match `<html lang>`.

## 5. BreadcrumbList (inner pages, not homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.example.com" },
    { "@type": "ListItem", "position": 2, "name": "Services", "item": "https://www.example.com/services" },
    { "@type": "ListItem", "position": 3, "name": "Websites" }
  ]
}
```

Min 2 items; omit `item` on the final (current) crumb. Helper:

```ts
// src/lib/schemas.ts
export function buildBreadcrumbs(crumbs: { name: string; path?: string }[], baseUrl = 'https://www.example.com') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name,
      ...(c.path ? { item: baseUrl + c.path } : {}),
    })),
  }
}
```

## 6. FAQPage

> Since 2023 FAQ **rich results** show only for authoritative government/health
> sites. Still worth adding where a real FAQ exists — Google parses it for
> understanding, cost is zero. Q&A must be **visible on the page**.

```ts
export function buildFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}
```

If FAQ text comes from a CMS/DB, `toJsonLd()` is doing real security work here —
this is exactly the dynamic-data case from §0.

## 7. LocalBusiness (physical premises only)

```json
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "name": "Example Dental Practice",
  "image": "https://www.example.com/photos/practice.jpg",
  "url": "https://www.example.com",
  "telephone": "+1-202-555-0143",
  "address": { "@type": "PostalAddress", "streetAddress": "123 Main St", "addressLocality": "Washington", "addressRegion": "DC", "postalCode": "20001", "addressCountry": "US" },
  "geo": { "@type": "GeoCoordinates", "latitude": 38.9072, "longitude": -77.0369 },
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:30" }],
  "priceRange": "$$"
}
```

Subtypes: `Dentist`, `MedicalClinic`/`Physician`, `SportsActivityLocation`,
`LegalService`/`Attorney`, `EducationalOrganization`. Required: name + address.

## 8. Article (blog/news/content)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article title (≤110 chars)",
  "image": ["https://www.example.com/16x9.jpg", "https://www.example.com/4x3.jpg", "https://www.example.com/1x1.jpg"],
  "datePublished": "2026-06-15T08:00:00+00:00",
  "dateModified": "2026-06-20T10:30:00+00:00",
  "author": [{ "@type": "Person", "name": "Jane Doe", "url": "https://www.example.com/authors/jane-doe" }],
  "publisher": { "@type": "Organization", "name": "Example Co", "logo": { "@type": "ImageObject", "url": "https://www.example.com/logo.png" } },
  "description": "One-sentence summary."
}
```

Subtypes: `Article`, `NewsArticle`, `BlogPosting`. Dates in ISO 8601 with
timezone. List each author separately with a profile `url`.

## 9. Event

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "CIO Summit 2026",
  "startDate": "2026-09-15T09:00:00-04:00",
  "endDate": "2026-09-15T17:00:00-04:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": { "@type": "Place", "name": "Venue", "address": { "@type": "PostalAddress", "streetAddress": "…", "addressLocality": "…", "postalCode": "…", "addressCountry": "US" } },
  "organizer": { "@type": "Organization", "name": "…", "url": "https://www.example.com" }
}
```

Required: name, `startDate` **with timezone offset**, location. Events must be
publicly attendable; don't mark sales/hours as events.

## 10. VideoObject

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Platform demo",
  "description": "What the video shows.",
  "thumbnailUrl": "https://www.example.com/thumb.jpg",
  "uploadDate": "2026-03-15T10:00:00+00:00",
  "duration": "PT3M42S",
  "contentUrl": "https://www.example.com/videos/demo.mp4",
  "embedUrl": "https://www.youtube.com/embed/xxxx"
}
```

Required: name, thumbnailUrl, uploadDate. Prefer `contentUrl`; `duration` is ISO
8601 (`PT1M54S`).

## 11. SoftwareApplication (SaaS / web-app landing pages)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Example App",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "What it does.",
  "url": "https://www.example.com",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.8, "ratingCount": 150 }
}
```

Required: name, `offers.price` ("0" for free), and `aggregateRating` **or**
`review`. **Only include ratings you can genuinely verify** — fabricated ratings
violate Google's guidelines and can trigger a manual action.

## 12. Course / ItemList (LMS, catalogues)

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "item": { "@type": "Course", "url": "https://www.example.com/courses/intro", "name": "Getting Started", "description": "…", "provider": { "@type": "Organization", "name": "Example Academy", "sameAs": "https://www.example.com" } } }
  ]
}
```

≥3 courses for rich-result eligibility; each a unique URL; no pricing/promo in
titles.

## 13. ProfilePage (portfolios, author pages)

```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "dateCreated": "2024-01-15",
  "dateModified": "2026-06-01",
  "mainEntity": { "@type": "Person", "name": "Jane Doe", "description": "Bio/credentials.", "image": "https://www.example.com/profile.jpg", "url": "https://www.example.com", "sameAs": ["https://www.linkedin.com/in/example"] }
}
```

## 14. Product (physical/e-commerce; SaaS prefers SoftwareApplication)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Example — Professional Plan",
  "description": "…",
  "brand": { "@type": "Brand", "name": "Example Co" },
  "offers": { "@type": "Offer", "price": "99", "priceCurrency": "USD", "priceValidUntil": "2026-12-31", "availability": "https://schema.org/InStock", "url": "https://www.example.com/plan" }
}
```

## 15. @graph (multiple schemas on one page)

Pass an **array** to `toJsonLd()` — it wraps them in a single
`{ "@context": ..., "@graph": [...] }` block (cleaner than N script tags, and
each item's redundant `@context` is stripped automatically). Google treats
`@graph` and separate tags identically.

## 16. Testing & validation

| Tool | Purpose |
|---|---|
| [Rich Results Test](https://search.google.com/test/rich-results) | Eligibility per page |
| [Schema Markup Validator](https://validator.schema.org/) | Validate any Schema.org markup |
| Search Console → Enhancements | Monitor rich results over time |
| Search Console → URL Inspection | How Google sees a specific URL |

Checklist:
1. Rich Results Test on each page type.
2. Errors block rich results; warnings are advisory.
3. Vite SPA: "View Source" won't show Helmet-injected JSON-LD unless
   prerendered — use the Rich Results Test / DevTools, and prefer prerendering.
4. `@context` is `https://schema.org` (https, not http).
5. All `url`/`image`/`logo` are **absolute**.
6. Dates ISO 8601 with timezone where applicable.
7. **Confirm dynamic values are escaped** — view the rendered page source and
   verify no `</script>` appears inside a JSON-LD block (proof `toJsonLd()` ran).
8. After deploy: URL Inspection → Request Indexing; allow days to process.

## Quick-start

1. Add `src/lib/json-ld.ts` (`toJsonLd`) and `src/lib/schemas.ts` (builders).
2. Check for an existing SEO component (`grep -rn "application/ld+json"`).
3. Organization + WebSite on the homepage (every project).
4. BreadcrumbList on inner pages; page-specific schemas where content matches.
5. Route dynamic values through `toJsonLd()` — no raw `JSON.stringify` in a tag.
6. Test with Rich Results Test before committing; verify in Search Console after.
