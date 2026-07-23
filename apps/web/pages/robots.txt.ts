import type { GetServerSideProps } from 'next';
import { abs, DISALLOWED_PATHS } from '../lib/seo';

// Dynamic robots.txt (Pages Router has no public/ dir here, and the origin is
// env-driven). Allows the public marketing/legal surface; disallows the
// authenticated app routes (thin client-rendered shells) and references the
// sitemap. See docs/SEO_FUNDAMENTALS.md.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${abs('/sitemap.xml')}`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.write(body);
  res.end();
  return { props: {} };
};

export default function Robots() {
  return null;
}
