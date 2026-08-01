// Shared SEO constants + JSON-LD for the public marketing/legal surface.
// The production origin comes from NEXT_PUBLIC_SITE_URL (set it in the deploy
// env; falls back to localhost for dev). See docs/SEO_FUNDAMENTALS.md.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://ourhomefolder.com';

export const SITE_NAME = 'Our Home Folder';
export const DEFAULT_DESCRIPTION =
  'Our Home Folder is a private place to document your home — rooms, utilities, appliances, warranties, repairs, and the papers that prove it all — so anyone can pick up where you left off.';

/** Absolute URL for a path, from SITE_URL. */
export const abs = (path = '/') => new URL(path, SITE_URL).toString();

/** Default social share card (1200×630) — the brand mark on the register's
 *  green ground. Pages can override via <Seo ogImage>. */
export const DEFAULT_OG_IMAGE = '/og.png';

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'en-US',
};

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

/** Public routes for the sitemap (authenticated app routes are excluded). */
export const PUBLIC_ROUTES = ['/', '/pricing', '/data-promise', '/pro', '/privacy', '/terms', '/sign-in', '/sign-up'];

/** App/private path prefixes to keep out of crawlers. */
export const DISALLOWED_PATHS = [
  '/home',
  '/utilities',
  '/assets',
  '/maintenance',
  '/documents',
  '/handover',
  '/settings',
  '/dashboard',
  '/property',
  '/create-property',
  '/add-asset',
  '/accept-invite',
  '/automation',
  '/api',
  '/mvp-test',
  '/welcome',
];
