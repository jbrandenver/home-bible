import Head from 'next/head';
import { abs, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME } from '../lib/seo';
import { toJsonLd } from '../lib/json-ld';

interface SeoProps {
  title: string;
  description?: string;
  /** Path (e.g. "/privacy") — canonical + og:url are built from SITE_URL. */
  path: string;
  ogImage?: string;
  noindex?: boolean;
  /** JSON-LD object or array (array → @graph). Serialized via toJsonLd. */
  structuredData?: object | object[];
}

/**
 * Per-page head for the public (non-authenticated) surface. Emits a unique
 * title, description, absolute self-referencing canonical, OG + Twitter tags,
 * and optional escaped JSON-LD.
 */
export function Seo({ title, description, path, ogImage, noindex, structuredData }: SeoProps) {
  const desc = description ?? DEFAULT_DESCRIPTION;
  const canonical = abs(path);
  const image = abs(ogImage ?? DEFAULT_OG_IMAGE);
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {image && <meta name="twitter:image" content={image} />}

      {structuredData && (
        <script
          type="application/ld+json"
          // Safe: toJsonLd escapes </script>/line-terminator breakout.
          dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
        />
      )}
    </Head>
  );
}
