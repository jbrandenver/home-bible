import { Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { Seo } from '../components/Seo';

// Branded not-found page (launch review 2026-07-31). Statically prerendered
// by Next, so it also serves as the Workers 404 for any unmatched route.
export default function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found — Our Home Folder" path="/404" noindex />
      <PageHeader
        eyebrow="Not on file"
        title="This page could not be found"
        description="The address may have been mistyped, or the record it pointed to may have moved."
      />
      <div style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
        <Card>
          <p style={{ marginTop: 0 }}>
            Nothing is filed at this address. If you followed a link from inside the app, the page
            may have moved — the dashboard is the fastest way back to your record.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <ActionLink href="/">Go to the front page</ActionLink>
            <ActionLink href="/dashboard" variant="secondary">
              Open your dashboard
            </ActionLink>
          </div>
        </Card>
      </div>
    </>
  );
}
