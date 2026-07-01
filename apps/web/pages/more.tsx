import { Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';

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
    description: 'Review account state, privacy, security reminders, and development tools.',
    href: '/settings',
    action: 'Open settings',
    group: 'Account'
  }
];

export default function MorePage() {
  const groups = Array.from(new Set(moreLinks.map((link) => link.group)));

  return (
    <>
      <PageHeader
        title="More"
        description="Documents, handover, sharing review, and settings."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Secondary tools</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Handover, Sharing Review, Settings, and Documents live here on mobile so the main workflow stays easy to reach.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UtilityBadge label="No public link is created" />
            <UtilityBadge label="No invitation is sent" />
            <UtilityBadge label="Preview only" />
          </div>
        </Card>

        {groups.map((group) => (
          <Card key={group}>
            <h2 style={{ marginTop: 0 }}>{group}</h2>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {moreLinks
                .filter((link) => link.group === group)
                .map((link) => (
                  <div key={link.href} style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 14 }}>
                    <h3 style={{ marginTop: 0 }}>{link.title}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{link.description}</p>
                    <ActionLink href={link.href} variant={link.title === 'Documents' ? 'primary' : 'secondary'}>
                      {link.action}
                    </ActionLink>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
