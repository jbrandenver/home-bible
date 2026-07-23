import type { GetServerSideProps } from 'next';
import { abs, PUBLIC_ROUTES } from '../lib/seo';

// Dynamic sitemap.xml — lists only the public canonical routes (authenticated
// app routes are excluded). Origin is env-driven via SITE_URL.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const urls = PUBLIC_ROUTES.map(
    (p) => `  <url><loc>${abs(p)}</loc></url>`
  ).join('\n');
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    '\n</urlset>\n';

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.write(body);
  res.end();
  return { props: {} };
};

export default function Sitemap() {
  return null;
}
