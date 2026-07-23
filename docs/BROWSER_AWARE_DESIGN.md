# Browser-Aware Web Design

Design websites that work *with* the browser's rendering pipeline, not against
it. Companion to the SEO suite: `SEO_FUNDAMENTALS.md` (Core Web Vitals targets),
`SEO_CRAWLABILITY_PLAYBOOK.md` (SSR/prerender so content survives a slow JS
path), and `WEB_ANALYTICS_GUIDE.md` (third-party scripts + consent). Adapted
from Addy Osmani's writing on modern browser internals.

## Core idea

**Visually rich, mechanically boring.** Strong imagery, refined motion,
interactive states, dense information — but the browser should never have to
fight the design to render it. Work with the pipeline:

1. Fetch the right resources early.
2. Parse HTML without unnecessary blocking.
3. Resolve CSS predictably.
4. Keep layout stable.
5. Paint only what needs painting.
6. Let the compositor handle motion where possible.
7. Keep JavaScript out of the critical visual path.

The goal isn't minimalism — it's **confidence**: the first screen appears
quickly, main content is prioritised, interaction stays smooth, and layout does
not shift while users are reading or acting.

The three Core Web Vitals this protects (targets from `SEO_FUNDAMENTALS.md`):
LCP < 2.5s, INP < 200ms, CLS < 0.1.

## Per-project quick map

| Project | Stack | What matters most |
|---|---|---|
| Workflow Weaver | Vite SPA (now prerendered) | The prerender pipeline already makes the public routes "survive a slow JS path" (§12). Keep the hero cheap; use plain `<img>` with width/height + `fetchpriority`. |
| Home Bible | Next 14 Pages Router | Use `next/image` for the landing hero; SSR the marketing surface (it already does). |
| Drive My Path | Next 16 App Router | Server components by default (good); `next/image` + `next/font`; keep `/app` dashboards skeleton-stable. |

---

## Design principles

### 1. Make the first screen cheap

The first viewport should be easy for the browser to construct.

**Good:** a clear LCP candidate (hero image, product render, headline block),
minimal font blocking, critical CSS early, deferred non-critical JS, stable
media dimensions.

**Bad:** competing hero assets; background video + custom fonts + animation
libraries + hydration-heavy UI stacked together; layout that depends on JS
measurement; components that render empty until client code runs.

Rule of thumb: **a page that can't look mostly correct before hydration is too
dependent on JavaScript.** (The Workflow Weaver prerender fix in
`SEO_CRAWLABILITY_PLAYBOOK.md` is exactly this principle applied.)

### 2. Prioritise the real LCP element

LCP is usually the thing the design cares about most. Treat it as a first-class
asset:

- Explicit `width`/`height` or `aspect-ratio`.
- Responsive sources so mobile doesn't download desktop media.
- Preload the real LCP image when known in advance.
- `fetchpriority="high"` for the main visual **only** — not for everything.
- Never lazy-load the primary above-the-fold image.

```html
<link rel="preload" as="image"
  href="/images/hero.avif"
  imagesrcset="/images/hero-800.avif 800w, /images/hero-1400.avif 1400w"
  imagesizes="100vw">

<img src="/images/hero.avif"
  srcset="/images/hero-800.avif 800w, /images/hero-1400.avif 1400w"
  sizes="100vw" width="1400" height="900"
  fetchpriority="high"
  alt="Product dashboard showing campaign performance">
```

**Next.js:** `next/image` with `priority` sets `fetchpriority="high"` + preload
and enforces dimensions for you — use it for the hero and skip the manual
`<link rel=preload>`. **Vite/plain HTML:** the markup above.

### 3. Don't block HTML parsing without a reason

Classic `<script>` blocks parsing by default.

- `defer` — needs the DOM, not critical to first paint.
- `async` — independent third-party where order doesn't matter.
- `type="module"` — modern module code (deferred by default).
- Keep analytics, widgets, chat, heatmaps, marketing tags off the critical path
  (and consent-gated — see `WEB_ANALYTICS_GUIDE.md`).

```html
<script src="/app.js" defer></script>
<script type="module" src="/main.js"></script>
```

### 4. Treat CSS as critical infrastructure

CSS is part of the pipeline, not just styling — the browser needs it to compute
style, layout, and paint.

- Critical CSS available early; avoid huge unused bundles and deep selectors in
  repeated UI.
- Use design-system primitives over page-specific CSS explosions.
- **Design every component state:** empty, loading, long-text, error,
  hover/focus, responsive. Undesigned states leave the browser improvising —
  usually with layout shifts.

### 5. Fonts: preload, swap, self-host

Web fonts are a top LCP/CLS cause (invisible text, then a reflow when the font
lands).

- `font-display: swap` (or `optional` for body text) so text renders immediately
  in a fallback.
- **Preload** the one or two fonts used above the fold; self-host or use
  `next/font` (which self-hosts + eliminates the render-blocking Google Fonts
  request).
- Match the fallback's metrics (`size-adjust`, `ascent-override`) to cut the
  swap reflow.
- Limit families/weights — each is a download and a potential shift.

```css
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand.woff2") format("woff2");
  font-display: swap;
}
```

### 6. Prefer compositor-friendly motion

Smoothest animations change only what the compositor can handle without layout
or large repaints: **`transform` and `opacity`.** Be careful with `width`,
`height`, `top`, `left`, `margin`, `padding`, `box-shadow`, `filter`, and large
background changes.

```css
/* Better — compositor handles this */
.panel {
  transform: translateY(8px);
  opacity: 0;
  transition: transform 180ms ease, opacity 180ms ease;
}
.panel[data-open="true"] { transform: translateY(0); opacity: 1; }

/* Riskier — forces layout each frame */
.panel { top: 8px; transition: top 180ms ease; }
```

### 7. Respect reduced motion

Motion is an accessibility concern, not just performance. Honor
`prefers-reduced-motion` — some users get nauseated or disoriented by movement.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Keep essential state changes (open/closed) instant rather than removing the
feedback entirely.

### 8. Use will-change sparingly, and clean it up

`will-change` promotes an element to its own layer to prepare for animation. Use
it for a **known active** element (a drawer about to open, a modal entering) —
not as a blanket rule; overuse increases memory and can hurt performance.
**Remove it once the animation ends** (via the data-state below, or in the
`transitionend` handler) so idle elements aren't stuck on their own layer.

```css
.drawer[data-state="opening"],
.drawer[data-state="open"] { will-change: transform; }
/* .drawer[data-state="closed"] intentionally omits will-change */
```

### 9. Avoid layout thrashing

Repeatedly writing to the DOM then reading layout forces the browser to
recompute geometry every time. Culprits: JS-measured masonry, scroll-linked
effects that constantly measure, animated accordions with nested content, sticky
nested panels, auto-resizing dashboards.

- Prefer CSS Grid/Flexbox; fixed `aspect-ratio` for repeated cards/tiles.
- Container queries for component-level responsiveness.
- **Batch reads then writes** in JS (measure everything, then mutate
  everything); or use `ResizeObserver`/`IntersectionObserver` instead of polling
  in a scroll handler.
- Virtualise very long lists (relevant to the Drive My Path team/meeting lists
  and any large table).

### 10. Design stable layouts (CLS is a design problem first)

Prevent shifts by designing: known media boxes, reserved ad/embed slots, stable
toolbar/nav heights, predictable skeletons, buttons that don't resize when
labels change, components that handle long words and empty values.

**Good loading states preserve the shape of the final UI.** Bad ones replace a
tiny spinner with a large content block that shoves everything down.

### 11. Render offscreen work lazily with `content-visibility`

For long pages with many below-the-fold sections, `content-visibility: auto`
lets the browser skip rendering (layout + paint) work for offscreen content
until it's needed — a large first-paint win. Pair with `contain-intrinsic-size`
so the skipped section still reserves space (no scrollbar jump = no CLS).

```css
.section-belowfold {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px; /* estimated height, reserves space */
}
```

Don't apply it to above-the-fold content or anything you need measured
immediately.

### 12. Make rich media earn its cost

For each major asset ask: is this the main thing users inspect? Sized for the
viewport? AVIF/WebP-compressed? Cropped to the real design? Given stable
dimensions? Loaded at the right priority? Is there a lighter mobile version?
Avoid decorative media that competes with real content for bandwidth.

### 13. Keep third-party scripts on a leash

Analytics, heatmaps, chat, tag managers, A/B testing, social embeds, ad scripts
can dominate the main thread and delay interactivity (INP). Never make the
primary experience depend on them; an essential widget still needs a reserved
area and a graceful fallback. Consent-gate them and load post-interaction —
see `WEB_ANALYTICS_GUIDE.md` (the consent flow also keeps GA off the critical
path until the user opts in).

### 14. Hydration should enhance, not rescue

Server-render the meaningful structure, let CSS handle initial layout, use JS to
*enhance* interaction, defer non-critical client components, avoid blank shells
where content should be. **Good design survives a slow JavaScript path.** For
the Vite SPA this is the prerender pipeline (`SEO_CRAWLABILITY_PLAYBOOK.md`); for
Next.js, keep pages as server components and isolate interactivity in small
client children (don't slap `"use client"` on a whole page — it also strips
SSR'd metadata).

### 15. Prefetch likely next steps — but not authenticated or destructive ones

Browsers can prepare a likely next navigation (landing → signup, product →
checkout). Use it where the path is predictable; prefetching everything wastes
bandwidth and hurts constrained devices.

```html
<script type="speculationrules">
{ "prefetch": [ { "source": "list", "urls": ["/pricing", "/signup"] } ] }
</script>
```

**Security/privacy caution:** speculation-rules `prefetch`/`prerender` fires a
**real, often credentialed request** before the user clicks — it leaks
navigation intent and pre-executes the target. So:
- Never speculate **authenticated, account, or state-changing URLs** (logout,
  delete, checkout-confirm, anything that mutates) — a prerender could fire the
  side effect. This is the browser-side echo of the endpoint-auth/authz rules:
  GET handlers must be side-effect-free.
- Only list **public, idempotent** marketing routes (pricing, signup form,
  docs).
- Prefetched requests carry cookies; treat them as real hits in analytics/rate
  limits.

---

## Website design checklist

**First viewport**
- One clear LCP candidate; page looks coherent before JS runs?
- Custom fonts limited, preloaded/self-hosted, `font-display: swap`?
- Hero/media dimensions stable; primary image eager + `fetchpriority="high"`?

**Layout**
- Media and card dimensions constrained (`aspect-ratio`)?
- Components handle long text and empty values without breaking?
- Loading states ≈ the size of loaded states?
- Embeds/ads/maps/videos given reserved space?
- Mobile uses appropriately cropped assets?

**Motion**
- Core animations on `transform`/`opacity`?
- Layout-changing animations rare and intentional?
- `will-change` only on active elements, cleaned up after?
- `prefers-reduced-motion` honored?

**JavaScript**
- Non-critical scripts deferred; third-party isolated + consent-gated?
- Expensive components lazy-loaded below the fold?
- No unnecessary client rendering for static content?
- DOM reads/writes batched where measurement is needed?

**Navigation & assets**
- Likely next pages prefetched only when predictable — and never
  authenticated/destructive URLs?
- Images compressed, correctly sized, AVIF/WebP?
- SVGs for simple icons/logos; videos postered, compressed, lazy where apt?
- `content-visibility: auto` on long below-the-fold sections?

---

## Practical patterns

**Product / marketing landing** (Workflow Weaver, Drive My Path, Home Bible
landing): server-rendered/prerendered hero, one optimised visual, critical CSS
early, deferred + consent-gated analytics, motion limited to fades/transforms.
Avoid full-screen loading animations, heavy background video, multiple font
families, hero images loaded via JS.

**SaaS dashboard** (Drive My Path `/app`, Home Bible app routes): dense but
stable layout, skeletons that preserve panel dimensions, virtualised long
tables, server-rendered shell, deferred charts below the fold. Avoid panels
resizing on load, charts blocking the whole dashboard, JS masonry for core
layout, controls that shift when values change.

**Editorial / content:** fast text, optimised lead image, minimal blocking
scripts, stable ad/embed slots, good typographic fallbacks. Avoid third-party
embeds in the article path before content, late font swaps, ads without reserved
dimensions.

**Ecommerce product page:** responsive product imagery, stable purchase
controls, lazy reviews/recommendations, prefetch cart/checkout when intent is
clear (but not the confirm/mutation endpoints — §15). Avoid loading the gallery
after hydration and shifts around price, variants, or the buy button.

## Red flags

- Page starts as a blank app shell (→ prerender/SSR).
- Hero depends on a client-side API call.
- Layout needs JavaScript to know its own size.
- Every scroll section animates layout properties.
- Main image is a CSS background with no preload plan.
- Loading state is a spinner, then everything appears at once.
- Five third-party scripts in the head.
- All cards have dynamic heights + lazy media with no aspect ratio.
- Mobile downloads the desktop hero.
- Speculation rules pointing at logout / delete / checkout-confirm.

## Rules of thumb

- One clear first-screen priority beats five competing visual ideas.
- The main image is never an afterthought.
- Moving → `transform`; fading → `opacity`.
- Anything that resizes needs a real reason to animate.
- Reserve space in advance for anything that loads late.
- Could HTML + CSS handle it instead of JavaScript?
- Keep non-essential third-party scripts off the critical path.
- Prefetch the next click when it's obvious — never an authenticated one.
- When a page feels clever but fragile, simplify the mechanics.

## Verify (Chrome DevTools / Lighthouse)

- Lighthouse (mobile) — check LCP/INP/CLS against the targets; read the "Largest
  Contentful Paint element" and "Avoid large layout shifts" audits.
- Performance panel → record a load → look for long tasks and layout/recalc
  spikes (thrashing).
- Coverage panel → unused CSS/JS on first load.
- Network → confirm the LCP image is `fetchpriority: High` and early; confirm
  third-party/analytics is not blocking.
- The Search Console Core Web Vitals report is the real-world field-data check
  (see `SEO_FUNDAMENTALS.md`).

## Prompt your AI assistant

```
Review this project against browser-aware web design. For the main pages check:

1. Is there ONE clear LCP element, preloaded (or next/image priority) with
   explicit dimensions and fetchpriority? Flag lazy-loaded above-the-fold heroes.
2. Are non-critical and third-party scripts deferred/async, off the critical
   path, and consent-gated? Flag anything render-blocking in <head>.
3. Do animations use only transform/opacity? Flag layout-property animations and
   blanket will-change. Is prefers-reduced-motion honored?
4. Are media/card dimensions constrained (width/height or aspect-ratio) and are
   loading states the same size as final content? Flag CLS risks.
5. Is meaningful content server-rendered/prerendered rather than fetched after
   hydration? Flag blank app shells and heroes behind a client API call.
6. Fonts: preloaded/self-hosted with font-display swap, limited families?
7. Speculation-rules/prefetch: only public idempotent URLs — flag any
   authenticated or state-changing target.

List concrete issues with file references and the specific fix for each. Report
only; do not change anything yet.
```
