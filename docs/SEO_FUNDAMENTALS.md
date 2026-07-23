# SEO Fundamentals & Technical Hygiene

The baseline every site needs to be crawled, indexed, and represented correctly.
Deep topics live in companion guides — this one is the map:

- **Crawlability / SPA prerendering** → `SEO_CRAWLABILITY_PLAYBOOK.md`
- **Structured data (JSON-LD)** → `STRUCTURED_DATA_GUIDE.md`
- **Analytics + cookie consent** → `WEB_ANALYTICS_GUIDE.md`
- Security of the CSP/headers here → `SECRETS_ENV_SECURITY.md`, `FORM_VALIDATION_SECURITY.md`

## Principles (what Google actually rewards)

- **People-first content.** Write for users; "written for search engines" is a
  documented quality signal against you.
- **Crawlable + understandable.** Google must reach the content, see it in the
  rendered HTML, and parse its meaning.
- **E-E-A-T:** Experience, Expertise, Authoritativeness, Trust. Real author
  identity, accurate claims, cited sources.
- Crawl → index → serve. You control the first two; the third is earned.

## Per-project quick map

| Project | Stack | SEO priority |
|---|---|---|
| Workflow Weaver | Vite SPA, no helmet/prerender | **Crawlability playbook first** — it serves an empty shell today |
| Home Bible (apps/web) | Next.js 14 **Pages Router** | Uses `next/head` + `getStaticProps`/`getServerSideProps`; hygiene check |
| Drive My Path | Next.js 16 App Router | SSR by default; metadata API + hygiene check |

## Meta tags & document head

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Primary Keyword — Brand</title>              <!-- 50–60 chars, unique per page -->
<meta name="description" content="Compelling 150–160 char summary written for humans" />
<link rel="canonical" href="https://yoursite.com/page" />  <!-- absolute, self-referencing -->

<!-- Open Graph (link previews on LinkedIn, Slack, iMessage, Facebook) -->
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://yoursite.com/page" />
<meta property="og:image" content="https://yoursite.com/og-image.jpg" />  <!-- absolute, 1200×630 -->
<meta property="og:site_name" content="Site Name" />
<meta property="og:locale" content="en_US" />

<!-- Twitter/X card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Page description" />
<meta name="twitter:image" content="https://yoursite.com/og-image.jpg" />

<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
```

**Deliberately omitted: `<meta name="keywords">`.** Google has ignored it since
2009 and it only advertises your target terms to competitors. Don't add it.

Every value above must be **unique per page** and **absolute** (full `https://`
URLs for canonical/OG image). Duplicate titles/canonicals across pages are the
single most common SPA SEO failure — see the crawlability playbook.

## robots.txt

Served at the site root. Controls *search* crawlers (not a security control —
anything you truly need private must be behind auth, never just Disallowed).

```txt
User-agent: *
Allow: /

# Block private / non-content paths
Disallow: /admin/
Disallow: /account/
Disallow: /api/
Disallow: /auth/

Sitemap: https://yoursite.com/sitemap.xml
```

Notes:
- **Drop `Crawl-delay`** — Googlebot ignores it (crawl rate is set in Search
  Console). Only Bing/Yandex honor it.
- **Drop per-bot `Allow` blocks** for Googlebot/Bingbot that just repeat the
  `*` rule — they add nothing.
- Don't `Disallow` a page you also want de-indexed: a blocked page can't be
  crawled, so Google never sees your `noindex`. To de-index, **allow** the
  crawl and use `noindex` (meta or `X-Robots-Tag`).
- Keep `robots.txt` consistent with `llms.txt` (below) and your sitemap.

## sitemap.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yoursite.com/</loc>
    <lastmod>2026-01-15T12:00:00+00:00</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- List **only** canonical, indexable, `200`-status public URLs (no redirects,
  no `noindex`, no admin).
- **Generate it from the same route source as your app/prerender manifest** so
  the two can never drift (the crawlability playbook wires this up).
- `lastmod` should be truthful; `changefreq`/`priority` are weak hints Google
  largely ignores — don't obsess over them.
- Next.js: prefer `app/sitemap.ts` (App Router) or a build script (Pages
  Router). Vite: a `scripts/generate-sitemap.js` step.

## llms.txt (AI-crawler guidance)

An emerging convention ([llmstxt.org](https://llmstxt.org/)) — a plain-text
file at the root that gives AI/LLM crawlers a concise, authoritative summary so
they represent your brand accurately. Low-cost hygiene, **not** a ranking
factor. Keep it factual and consistent with `robots.txt`.

```txt
# llms.txt — AI crawler guidance
# https://llmstxt.org/ — Last updated: 2026-01-01

User-agent: *
Allow: /

# ── ORGANISATION ──
# Name: Your Organisation
# Website: https://yoursite.com
# What we do: One-line description
# Contact: contact@yoursite.com

# ── CORE OFFERINGS ──
# - Offering one — short benefit
# - Offering two — short benefit

# ── KEY FACTS (help models answer accurately) ──
# - Differentiator / metric #1

# ── ATTRIBUTION ──
# Attribute to "Your Organisation", link https://yoursite.com
```

Note: AI-crawler *access control* is still mostly done via `robots.txt`
user-agent rules (`GPTBot`, `Google-Extended`, `ClaudeBot`, `CCBot`, etc.).
`llms.txt` is context, not enforcement — neither file stops a crawler that
ignores conventions.

## Content structure

- **One `<h1>` per page**, then a meaningful `<h2>`/`<h3>` hierarchy.
- **Page title:** `Primary Keyword — Brand`, 50–60 chars, unique.
- **Meta description:** 150–160 chars, written to earn the click; keywords
  natural, never stuffed.
- **Internal links** with descriptive anchor text (not "click here").
- Content must live in the **rendered DOM**, reachable via real `<a href>`
  links — not injected only by JS click handlers, not hidden behind
  interaction. (SPAs: see the crawlability playbook.)

## Core Web Vitals (a ranking signal + UX)

| Metric | Good | Note |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 s | Largest visible element painted |
| INP (Interaction to Next Paint) | < 200 ms | **Replaced FID as a Core Web Vital in March 2024** |
| CLS (Cumulative Layout Shift) | < 0.1 | Reserve space for images/embeds/fonts |

Levers: optimize/size images (WebP/AVIF, explicit width/height), lazy-load
below-the-fold, minimize and defer JS, use a CDN + caching, self-host or
`font-display: swap` fonts. Measure with PageSpeed Insights / Lighthouse and
the Search Console Core Web Vitals report (real field data).

## HTTPS & headers

- Whole site on HTTPS; redirect HTTP→HTTPS; internal links use `https://`.
- Send security headers (`Strict-Transport-Security`, `X-Content-Type-Options:
  nosniff`, a `Content-Security-Policy`). CSP specifics for analytics are
  below.

### CSP for Google Analytics / GTM — with the security tradeoff stated

GA4/GTM need these directives. **`'unsafe-inline'` (and `'unsafe-eval'` if you
use GTM Custom JavaScript Variables) materially weaken CSP's XSS protection** —
they're a real tradeoff, not free. Prefer a **nonce-based CSP** (per-request
nonce in middleware) once you can; use `'unsafe-inline'` only as the pragmatic
interim, and never pair it with injecting unescaped dynamic data into inline
scripts (see `STRUCTURED_DATA_GUIDE.md` for the JSON-LD escaping rule).

Use **wildcard Google subdomains** ([per Google's CSP guide](https://developers.google.com/tag-platform/security/guides/csp)) — they change hostnames.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://*.googletagmanager.com;
  connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com;
  img-src 'self' data: https://*.google-analytics.com https://*.googletagmanager.com;
  style-src 'self' 'unsafe-inline';
  upgrade-insecure-requests;
```

Next.js (`next.config.ts` headers) and Vercel/SPA (`vercel.json` headers)
examples follow the same directive list. After changing CSP: deploy to preview,
open a GA-enabled page, check DevTools console for CSP violations, confirm
`gtag/js` loads and beacons fire, and verify real-time hits in GA4.

**Analytics must be consent-gated** in the EU/UK and similar regions — the raw
"paste this snippet and it fires on load" approach is not compliant. Do **not**
ship an always-on GA tag; use the consent flow in `WEB_ANALYTICS_GUIDE.md`. A
GA **measurement ID is publishable** (safe in the client bundle) — but it still
must not fire before consent.

## Google Search Console workflow

**One-time:** add a property (**Domain property** via DNS TXT covers all
subdomains + http/https; or **URL-prefix** for one exact origin) → verify
ownership → submit the sitemap **path** (`sitemap.xml`, not an upload).

**On publish/change:** URL Inspection → **Test Live URL** to confirm Google
sees real content (not an empty shell) → **Request Indexing** for a handful of
new/changed URLs (per-URL, quota-limited; rely on the sitemap for bulk).

**Ongoing:** watch the **Pages (Indexing)** report for *"Discovered – currently
not indexed"* and *"Crawled – currently not indexed"* (classic thin/duplicate
symptoms on client-rendered SPAs); check **Enhancements** (validates your
JSON-LD), **Core Web Vitals** (field data), and **Manual Actions / Security
Issues** (rare but can deindex you).

## Common mistakes

1. Empty-shell SPA served to crawlers (→ crawlability playbook)
2. Duplicate/generic titles, descriptions, canonicals across pages
3. `meta keywords`, `Crawl-delay` — dead weight
4. `Disallow`-ing a page you meant to `noindex` (Google never sees the noindex)
5. Analytics firing before consent (legal risk) — and unescaped dynamic data in
   JSON-LD/inline scripts (XSS risk)
6. Non-absolute canonical/OG URLs; missing OG image → identical link previews
7. No HTTPS; slow LCP; layout shift from unsized media

## Checklist

- [ ] HTTPS everywhere; HTTP→HTTPS redirect
- [ ] Unique title + description + canonical (absolute) per page
- [ ] OG + Twitter tags per page, absolute `og:image`
- [ ] One `<h1>`; sane heading hierarchy
- [ ] `robots.txt` (no Crawl-delay, blocks private paths, references sitemap)
- [ ] `sitemap.xml` from the same route source as the app; canonical URLs only
- [ ] `llms.txt` (optional), consistent with robots.txt
- [ ] Structured data per page type (→ structured-data guide)
- [ ] Analytics consent-gated (→ analytics guide); CSP set with tradeoffs understood
- [ ] Content in rendered DOM, real `<a href>` links (→ crawlability playbook for SPAs)
- [ ] Core Web Vitals passing (LCP<2.5s, INP<200ms, CLS<0.1)
- [ ] Search Console property verified, sitemap submitted, indexing monitored

> "Providing a good user experience should be your site's top goal." — Google
