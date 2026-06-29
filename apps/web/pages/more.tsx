import Link from 'next/link';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';

const moreLinks = [
  {
    title: 'Documents',
    description: 'Open the private file cabinet for manuals, reports, receipts, photos, permits, and insurance documents.',
    href: '/documents',
    action: 'Open documents',
    group: 'Files'
  },
  {
    title: 'Handover',
    description: 'Build browser-only, print-friendly reports for family, buyer, maintenance, insurance, or archive use.',
    href: '/handover',
    action: 'Open handover',
    group: 'Review tools'
  },
  {
    title: 'Sharing Review',
    description: 'Preview future role visibility without creating invitations, guest access, or public links.',
    href: '/sharing',
    action: 'Open sharing review',
    group: 'Review tools'
  },
  {
    title: 'Settings',
    description: 'Review account state, security reminders, privacy posture, and release-candidate status.',
    href: '/settings',
    action: 'Open settings',
    group: 'Account'
  },
  {
    title: 'MVP Test',
    description: 'Development-only checklist for private MVP testing. Keep this out of real customer workflows.',
    href: '/mvp-test',
    action: 'Open test checklist',
    group: 'Development tools'
  }
];

export default function MorePage() {
  const groups = Array.from(new Set(moreLinks.map((link) => link.group)));

  return (
    <>
      <PageHeader
        title="More"
        description="Secondary tools, review workflows, settings, and development-only testing links."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Secondary tools</h2>
          <p style={{ color: '#6b7280' }}>
            Handover, sharing review, settings, and documents live here on mobile so the main navigation stays focused.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UtilityBadge label="No public sharing" />
            <UtilityBadge label="No invitations" />
            <UtilityBadge label="No background jobs" />
          </div>
        </Card>

        {groups.map((group) => (
          <Card key={group}>
            <h2 style={{ marginTop: 0 }}>{group}</h2>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {moreLinks
                .filter((link) => link.group === group)
                .map((link) => (
                  <div key={link.href} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                    <h3 style={{ marginTop: 0 }}>{link.title}</h3>
                    <p style={{ color: '#6b7280' }}>{link.description}</p>
                    <Link href={link.href}>
                      <Button type="button">{link.action}</Button>
                    </Link>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
