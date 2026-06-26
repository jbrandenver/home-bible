import Link from 'next/link';
import { PageHeader, Card, Button, UtilityBadge } from '@home-bible/ui';

export default function SettingsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f5ef',
        padding: '48px 20px'
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <PageHeader
          title="Settings"
          description="Account, property, privacy, sharing, billing, export, and deletion controls will live here."
        />

        <div style={{ display: 'grid', gap: 24 }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Security and privacy</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <UtilityBadge label="Account deletion required" />
              <UtilityBadge label="Data export required" />
              <UtilityBadge label="No access codes" />
              <UtilityBadge label="Address optional" />
            </div>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Future settings sections</h2>
            <ul style={{ color: '#4b5563', lineHeight: 1.8 }}>
              <li>Account</li>
              <li>Properties</li>
              <li>Plan and billing</li>
              <li>Sharing</li>
              <li>Privacy</li>
              <li>Data export</li>
              <li>Delete account</li>
              <li>Support</li>
            </ul>
          </Card>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button type="button">Back to dashboard</Button>
            </Link>
            <Link href="/home-map">
              <Button type="button">Home map</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
