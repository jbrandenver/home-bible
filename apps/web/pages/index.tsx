import { Card, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';

export default function Home() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Card tone="dark">
        <div style={{ maxWidth: 760 }}>
          <UtilityBadge label="A home, documented." />
          <h1 style={{ margin: '18px 0 10px', fontSize: 'clamp(2.6rem, 7vw, 4rem)' }}>Home & Everything</h1>
          <p style={{ fontSize: 20, marginTop: 0 }}>
            A calm, complete record of the place you live.
          </p>
          <p>
            Keep rooms, utilities, documents, receipts, warranties, and care history in one quiet archive.
            Beautiful enough to keep, clear enough to hand on.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          <ActionLink href="/create-property">Start your home record</ActionLink>
          <ActionLink
            href="/sign-in"
            variant="secondary"
            style={{ color: 'var(--text-inverse)', borderColor: 'rgba(236,226,207,0.42)' }}
          >
            Sign in
          </ActionLink>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Find the important things</h2>
          <p style={{ color: 'var(--text-muted)' }}>Where is the main water shut-off? Which room has the router? What needs attention next?</p>
          <ActionLink href="/home" variant="secondary">Open Home</ActionLink>
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>Keep the record complete</h2>
          <p style={{ color: 'var(--text-muted)' }}>Documents, receipts, warranties, repairs, and service history stay connected to the home.</p>
          <ActionLink href="/dashboard" variant="secondary">Go to dashboard</ActionLink>
        </Card>
      </div>
    </div>
  );
}
