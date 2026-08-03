import { Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';

// The service worker's floor: shown when a navigation fails with no cached
// copy of the page. Static on purpose — it must render with no network and
// no data.
export default function OfflinePage() {
  return (
    <>
      <PageHeader
        title="You're offline"
        description="The record is safe — this page just can't reach it right now."
      />
      <Card>
        <p style={{ marginTop: 0 }}>
          Nothing has been lost. Once you&rsquo;re back on a connection, everything picks up
          exactly where it left off.
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          Pages you visited recently may still open from memory — try the dashboard.
        </p>
        <ActionLink href="/dashboard">Try the dashboard</ActionLink>
      </Card>
    </>
  );
}
