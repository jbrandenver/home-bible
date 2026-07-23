# SEO Crawlability Playbook: Fix Client-Rendered SPAs for Google

**Purpose:** a self-contained task list for one focused session to diagnose and
fix the "empty shell" problem in a client-rendered React SPA. Run **one project
per session**. The reference implementation is inlined — copy it into the
project you're fixing; you need no other file.

Companion to `SEO_FUNDAMENTALS.md` (hygiene), `STRUCTURED_DATA_GUIDE.md`
(JSON-LD), and `WEB_ANALYTICS_GUIDE.md` (analytics).

**The core problem:** a pure client-side-rendered (CSR) React + Vite SPA serves
an empty `<div id="root"></div>` for *every* URL. Content and per-route head
tags (`<title>`, description, canonical, OG, JSON-LD) are injected by JS *after*
load. Google can render JS in a deferred second wave, but:
- Indexing is slower and less reliable; failed renders get indexed as the
  generic shell → duplicate titles/snippets across pages.
- Non-JS crawlers (Bing is weak; social/link-preview bots — WhatsApp, LinkedIn,
  Facebook, X, Slack, iMessage — run **no** JS) see only the shell, so every
  shared link shows the same title/description/image.

## Applicability to Jesse's projects

| Project | Verdict |
|---|---|
| **Workflow Weaver** (Vite SPA, no react-helmet, no prerender) | **Primary target.** It serves an empty shell today. Adopting this playbook also means adding `react-helmet-async` (or adapting its existing `usePageTitle` hook) to emit per-route head tags. |
| **Home Bible** (Next.js 14 **Pages Router**) | SSR/SSG-capable already — run the Next.js hygiene branch, no rebuild. |
| **Drive My Path** (Next.js 16 App Router) | SSR by default — hygiene branch only. |

---

## How to use this file

1. Identify **Vite** vs **Next.js** (`vite.config.*` vs `next.config.*`).
2. Do **Phase 0 (Diagnose)**. If the project already serves real per-route HTML,
   mark DONE and stop.
3. Empty-shell problem → **Vite branch** or **Next.js branch**.
4. Finish with **Phase 3 (Verify)**: evidence before claiming done.

---

## Phase 0: Diagnose

```bash
SITE="https://www.example.com"
INNER="$SITE/some-inner-page"   # use a real inner page, not just the homepage

# 1. What Googlebot gets on FIRST fetch (pre-JS)
curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$SITE"  > /tmp/home.html
curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$INNER" > /tmp/inner.html

# 2. Is the root div empty? (empty == problem)
grep -o '<div id="root">[^<]*</div>' /tmp/home.html

# 3. Do two routes return IDENTICAL html? (identical == problem)
[ "$(md5 -q /tmp/home.html)" = "$(md5 -q /tmp/inner.html)" ] \
  && echo "IDENTICAL SHELL — needs prerendering" || echo "Distinct HTML — likely OK"

# 4. Compare titles across routes (same generic title == problem)
grep -o '<title>[^<]*</title>' /tmp/home.html /tmp/inner.html

# 5. Visible word count in raw HTML (tiny == problem)
for f in /tmp/home.html /tmp/inner.html; do
  echo "$f: $(sed 's/<[^>]*>//g' "$f" | tr -s ' \n' ' ' | wc -w) words"; done

# 6. Any existing prerender/SSG step?
grep -iE 'prerender|react-snap|vite-react-ssg|vike|vite-plugin-ssr|renderToString' \
  package.json 2>/dev/null
```

**Verdict:** empty `<div id="root">` **and** identical HTML across routes
**and** same generic `<title>` → **HAS THE PROBLEM**. Distinct per-route HTML
with real content → already fixed (or Next.js SSR); mark DONE.

Also note current hygiene (Phase 2): `public/robots.txt`, `public/sitemap.xml`,
`public/llms.txt`, per-route SEO component.

---

## Phase 1A: Vite branch — build-time prerendering

Goal: after `vite build`, render every public route to `dist/<route>/index.html`
with real content + correct head tags baked in. Replicate the reference below;
do **not** invent a new mechanism.

### Privacy guardrail (read before you prerender)

Prerendering bakes rendered HTML into **static files served to everyone**. Only
prerender **public, non-personalized** routes. Never prerender authenticated,
account, or user-specific pages — you would freeze one user's data into a public
file. Exclude `admin`, `account`, `booking`, `auth`, dashboards, and anything
behind a login from the manifest, matching `robots.txt`. The `preloaded` data
you inject must be public catalog data only.

**`src/prerender/routes.tsx`** — route manifest, single source of truth. Use
**eager** imports (NOT `React.lazy` — `renderToString` can't resolve Suspense
synchronously). Share `staticRoutes.json` with the sitemap generator.

```tsx
// src/prerender/routes.tsx
import React from 'react';
import { LandingPage } from '../pages/LandingPage';
import { AboutPage } from '../pages/AboutPage';
import { CoursePage } from '../pages/CoursePage';
import staticRoutes from './staticRoutes.json';

export interface PrerenderRoute {
  path: string;                          // ':slug' marks a dynamic template
  Component: React.ComponentType<any>;
  props?: Record<string, unknown>;
  getData?: () => Promise<Array<{ slug: string; preloaded?: Record<string, unknown> }>>;
}

const COMPONENT_BY_PATH: Record<string, React.ComponentType<any>> = {
  '/': LandingPage,
  '/about': AboutPage,
};

const staticPrerenderRoutes: PrerenderRoute[] = (staticRoutes as Array<{ path: string }>).map((r) => ({
  path: r.path,
  Component: COMPONENT_BY_PATH[r.path],
}));

// Dynamic template — fetch the item list. Time-box it so a slow API can't hang the build.
// Fetch only PUBLIC data; it becomes part of a public static file.
async function getCourses(): Promise<Array<{ slug: string; preloaded: Record<string, unknown> }>> {
  const res = await fetch('https://api.yoursite.com/courses', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`courses API ${res.status}`);
  const items = await res.json();
  return items.map((c: any) => ({ slug: c.slug, preloaded: { course: c } }));
}

export const prerenderRoutes: PrerenderRoute[] = [
  ...staticPrerenderRoutes,
  { path: '/courses/:slug', Component: CoursePage, getData: getCourses },
];
```

**`src/prerender/render.tsx`** — `renderRoute()` + the pure
`injectIntoTemplate()`. The `canUseDOM = false` flip forces react-helmet-async
into SSR mode so head tags land in `helmetContext`.

```tsx
// src/prerender/render.tsx
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../lib/theme';
import { AuthProvider } from '../lib/auth';

export interface RenderInput {
  path: string;
  Component: React.ComponentType<any>;
  props?: Record<string, unknown>;
  preloaded?: Record<string, unknown>;    // injected as window.__PRELOADED__
  routePattern?: string;
}
export interface RenderOutput { bodyHtml: string; headHtml: string; }

export async function renderRoute(input: RenderInput): Promise<RenderOutput> {
  const routePattern = input.routePattern ?? input.path;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const helmetContext: { helmet?: any } = {};

  const prevCanUseDOM = (HelmetProvider as any).canUseDOM;
  (HelmetProvider as any).canUseDOM = false; // SSR mode; restore in finally

  // react-router <Link> useLayoutEffect warns on the server; filter just that one message.
  const prevConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.includes('useLayoutEffect does nothing on the server')) return;
    prevConsoleError(...(args as []));
  };

  try {
    const bodyHtml = renderToString(
      <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <MemoryRouter initialEntries={[input.path]}>
                <Routes>
                  <Route path={routePattern} element={<input.Component {...(input.props ?? {})} />} />
                </Routes>
              </MemoryRouter>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    );
    const h = helmetContext.helmet;
    const headHtml = h
      ? [h.title.toString(), h.meta.toString(), h.link.toString(), h.script.toString()].join('\n')
      : '';
    return { bodyHtml, headHtml };
  } finally {
    (HelmetProvider as any).canUseDOM = prevCanUseDOM;
    console.error = prevConsoleError;
  }
}

// Strip the shell's default head tags before injecting per-route ones (no duplicates).
const DEFAULT_HEAD_PATTERNS: RegExp[] = [
  /<title>[^<]*<\/title>/i,
  /<meta\s+name="description"[^>]*>/i,
  /<meta\s+property="og:[^"]*"[^>]*>/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>/gi,
  /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi,
];

// Escape a JS string for safe embedding inside an inline <script>. Prevents a
// value like "</script>" (or a U+2028/U+2029 line separator, which are raw
// newlines in JS) from breaking out of the tag — the same rule as JSON-LD in
// STRUCTURED_DATA_GUIDE.md. JSON.stringify ALONE is not enough.
function escapeForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Pure: inject rendered head/body/preloaded into the built index.html template. */
export function injectIntoTemplate(
  template: string,
  parts: { headHtml: string; bodyHtml: string; preloaded?: Record<string, unknown> }
): string {
  let html = template;
  for (const re of DEFAULT_HEAD_PATTERNS) html = html.replace(re, '');
  html = html.replace('</head>', `${parts.headHtml}\n</head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${parts.bodyHtml}</div>`);
  if (parts.preloaded) {
    const json = escapeForScript(JSON.stringify(parts.preloaded));
    html = html.replace(
      '<script type="module"',
      `<script>window.__PRELOADED__=${json}</script>\n<script type="module"`
    );
  }
  return html;
}
```

**`scripts/prerender.mjs`** — post-build renderer. Boots Vite in
`middlewareMode` only to SSR-load the two TS modules (so `@` alias, CSS imports,
`import.meta.env` resolve). Wrap each route in try/catch: **never fail the whole
build for one route**. End with `process.exit(0)` so esbuild handles can't hang.

```js
#!/usr/bin/env node
// scripts/prerender.mjs — run AFTER `vite build` (dist/index.html is the template).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEMPLATE_PATH = path.join(DIST, 'index.html');

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('✖ dist/index.html not found — run `vite build` first.');
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // See the Supabase/env gotcha below: mode:'production' + define so import-time
  // env reads never throw and never make live calls during prerender.
  const fileEnv = loadEnv('production', ROOT, 'VITE_');
  const pick = (k, fb) => fileEnv[k] || process.env[k] || fb;
  const define = {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(pick('VITE_SUPABASE_URL', 'https://placeholder.supabase.co')),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(pick('VITE_SUPABASE_PUBLISHABLE_KEY', 'placeholder')),
    // ...add every VITE_* var any import-time-throwing module reads.
  };

  const vite = await createServer({
    mode: 'production',
    define,
    server: { middlewareMode: true, hmr: false, watch: null }, // no watcher/HMR handle keeps Node alive
    optimizeDeps: { noDiscovery: true },
    appType: 'custom',
    logLevel: 'warn',
  });

  try {
    const { prerenderRoutes } = await vite.ssrLoadModule('/src/prerender/routes.tsx');
    const { renderRoute, injectIntoTemplate } = await vite.ssrLoadModule('/src/prerender/render.tsx');

    let written = 0;
    for (const route of prerenderRoutes) {
      try {
        if (route.path.includes(':')) {
          const items = route.getData ? await route.getData() : [];
          for (const item of items) {
            const routePath = route.path.replace(':slug', item.slug);
            const { bodyHtml, headHtml } = await renderRoute({
              path: routePath, Component: route.Component,
              routePattern: route.path, preloaded: item.preloaded,
            });
            writeRoute(injectIntoTemplate(template, { headHtml, bodyHtml, preloaded: item.preloaded }), routePath);
            written++;
          }
        } else {
          const { bodyHtml, headHtml } = await renderRoute({
            path: route.path, Component: route.Component, props: route.props,
          });
          writeRoute(injectIntoTemplate(template, { headHtml, bodyHtml }), route.path);
          written++;
        }
      } catch (err) {
        console.warn(`⚠ prerender skipped ${route.path}: ${err.message}`); // SPA fallback still serves it
      }
    }
    console.log(`✔ prerendered ${written} routes`);
  } finally {
    await vite.close();
  }
}

function writeRoute(html, routePath) {
  const rel = routePath === '/' ? 'index.html' : path.join(routePath.replace(/^\//, ''), 'index.html');
  const outPath = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
}

main()
  .then(() => process.exit(0)) // force clean exit; esbuild/worker handles can hang the build
  .catch((err) => { console.error('✖ prerender failed:', err); process.exit(1); });
```

**`src/prerender/staticRoutes.json`** — shared source of truth for the manifest
**and** the sitemap generator:

```json
[
  { "path": "/" },
  { "path": "/about" }
]
```

### Task list
- [ ] `react-dom/server` is available (ships with `react-dom`); add `jsdom` as a
      devDependency only if the render path needs a DOM shim.
- [ ] Create `src/prerender/routes.tsx` with **eager** imports; **exclude
      private/no-index routes** so they match `robots.txt`.
- [ ] Create `src/prerender/staticRoutes.json` (single source of truth).
- [ ] Create `src/prerender/render.tsx` (above). Wrap the render in the app's
      real **public** provider stack; any provider network/localStorage access
      must live in `useEffect`/callbacks so it never runs during SSR.
- [ ] Create `scripts/prerender.mjs` (near-verbatim).
- [ ] Wire the build (order matters):
      `"build": "node scripts/copy-robots.js && node scripts/generate-sitemap.js && tsc && vite build && node scripts/prerender.mjs"`
- [ ] Keep `main.tsx` on `createRoot(...).render(...)`. The client re-renders
      over the prerendered HTML; crawlers get static HTML, users get a normal
      client render. This avoids hydration-mismatch fragility. Only switch to
      `hydrateRoot` if you specifically need hydration and have verified no
      mismatch.
- [ ] Per-route SEO component (react-helmet-async) sets a **unique** title,
      description, canonical, OG, and JSON-LD for every route — that's what
      makes the static HTML distinct. **(Workflow Weaver has no helmet yet — add
      `react-helmet-async` and a shared `<SEO>` component, or extend its
      `usePageTitle` hook to emit full head tags.)**
- [ ] Tests (`routes.test.tsx`, `render.test.tsx`): each route renders a
      non-empty body + unique title; sitemap/manifest parity.

### Vercel config
- [ ] Output dir stays `dist`; prerendered files serve as static HTML.
- [ ] SPA rewrite is a **fallback only** (`/((?!api/|.*\..*|assets/).*)` →
      `/index.html`); static files take precedence, so inner routes serve baked HTML.
- [ ] `"cleanUrls": true` / consistent `trailingSlash` so `/x` and `/x/` don't
      split signals; match canonical tags to your choice.

### Gotcha: env-dependent module-load throws fail the build on Vercel (Supabase, etc.)

**Symptom:** builds locally, fails on Vercel in the prerender step with e.g.
`Supabase URL is not defined` thrown from a client/config module, stack through
`ssrLoadModule`. Expect this on any Vite + Supabase site.

**Why (two compounding causes):**
1. **Mode.** `createServer` defaults to **development**, so `import.meta.env.PROD`
   is `false`; code that picks an instance by that flag selects a DEV var that
   often isn't set on Vercel. → pass `mode: 'production'`.
2. **Env exposure.** Vite's SSR module runner does **not** expose custom
   `VITE_*` to `import.meta.env` the way `vite build` inlines them. On Vercel
   the vars are in `process.env` (no committed `.env`), so they read `undefined`
   during SSR. A module that **throws at import** on a missing value fails the
   whole prerender.

**Fix (shown in the script above):** inject via Vite `define` from
`loadEnv`/`process.env`, with harmless placeholder fallbacks. Placeholders are
safe because `renderToString` runs no effects — no client makes a network call
during prerender. **Verify locally** by moving `.env` aside and unsetting the
vars, then `npm run build` must still prerender all routes (use a `trap ... EXIT`
to restore `.env`). This is exactly the classification from
`SECRETS_ENV_SECURITY.md`: these `VITE_*` values are **publishable**, so
placeholders in a build script are fine — never do this with a secret.

---

## Phase 1B: Next.js branch — hygiene check (usually no rebuild)

App Router (Drive My Path) and Pages Router (Home Bible) both render server-side,
so the empty-shell problem normally doesn't exist. Verify and fix only gaps:

- [ ] Phase 0 curl already shows distinct per-route HTML with real content → no
      rendering work.
- [ ] **App Router:** each route exports `metadata` or `generateMetadata()` with
      a **unique** title + description + canonical (`alternates.canonical`) +
      `openGraph`. **Pages Router (Home Bible):** each page sets its head via
      `next/head` (or `next-seo`) with unique tags; data via
      `getStaticProps`/`getServerSideProps`.
- [ ] Dynamic routes: `generateStaticParams()` (App) / `getStaticPaths()`
      (Pages) where the set is known, for SSG.
- [ ] `app/sitemap.ts` / `app/robots.ts` (App) or `public/sitemap.xml` +
      `public/robots.txt` (Pages), current and referencing each other.
- [ ] **App Router:** watch for an accidental `"use client"` at the top of a
      page that should be a server component — it pushes rendering client-side
      and can strip SSR'd metadata. Keep pages as server components; isolate
      interactivity in child client components.
- [ ] JSON-LD rendered server-side (→ `STRUCTURED_DATA_GUIDE.md`, and use its
      escaping helper for any dynamic values).

---

## Phase 2: Shared SEO hygiene (both stacks)

- [ ] `robots.txt` / `app/robots.ts`: allow public pages, block `/admin`,
      `/account`, `/booking*`, `/api`, dev paths; reference absolute sitemap URL.
- [ ] `sitemap.xml`: all public canonical URLs, generated from the same route
      source as the prerender manifest (no drift). Absolute `https://`, sane `lastmod`.
- [ ] `llms.txt`: AI-crawler policy + concise org summary, consistent with
      robots.txt (→ `SEO_FUNDAMENTALS.md`). Emerging convention, not a ranking factor.
- [ ] Canonical tag on every page (absolute, self-referencing).
- [ ] OG + Twitter per page; confirm a shared link preview now differs per page.
- [ ] One `<h1>` per page; meaningful hierarchy.
- [ ] JSON-LD appropriate to page type (Organization/WebSite on home; Article on
      posts; BreadcrumbList on inner pages) — → structured-data guide.

---

## Phase 3: Verify (evidence before claiming done)

- [ ] `npm run build` succeeds; `dist/<route>/index.html` exists for inner
      routes (Vite).
- [ ] Re-run Phase 0 curls against the built output / preview deploy:
      - `<div id="root">` now contains real markup.
      - Two routes return DIFFERENT html with DIFFERENT `<title>`/description.
      - Visible word count is substantial, not ~20.
- [ ] Paste an inner URL into a link-preview tester (or WhatsApp/LinkedIn) → the
      preview shows that page's own title/description/image.
- [ ] (If access) Search Console → URL Inspection → "View Crawled Page" shows
      real content; no unexpected "Discovered/Crawled – currently not indexed".
- [ ] No `<title>`/canonical duplicated across distinct pages.

---

## Reference file layout

| Concern | File |
|---|---|
| Post-build renderer | `scripts/prerender.mjs` |
| Route manifest (source of truth) | `src/prerender/routes.tsx` + `src/prerender/staticRoutes.json` |
| Render + template injection | `src/prerender/render.tsx` |
| Sitemap generator | `scripts/generate-sitemap.js` |
| Env-aware robots.txt copy | `scripts/copy-robots.js` |
| Build wiring | `package.json` → `"build"` |
| Tests | `src/prerender/{routes,render}.test.tsx` |

## Version history
- **v1.2** (this rewrite): hardened `preloaded` injection (escape `< > & U+2028
  U+2029`, matching the JSON-LD rule); added a privacy guardrail (never
  prerender authenticated/personalized routes); per-project applicability;
  env-gotcha tied to secrets classification; Pages-Router specifics for the
  Next.js branch.
- **v1.1**: self-contained; inlined reference implementation; added llms.txt.
- **v1.0**: initial playbook.
