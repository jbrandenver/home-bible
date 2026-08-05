import { Card, PageHeader, UtilityBadge } from '@home-folder/ui';
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
    title: 'The Tool Shed',
    description: 'Track every tool in the house, recorded where it lives — garage, shed, utility room, or basement bench.',
    href: '/tools',
    action: 'Open tools',
    group: 'Records'
  },
  {
    title: 'Home Inventory',
    description: 'A room-by-room record of what you own with serials and values — your proof after a fire, flood, or theft.',
    href: '/inventory',
    action: 'Open inventory',
    group: 'Records'
  },
  {
    title: 'Handover',
    description: 'Build browser-only, print-friendly reports for family, buyer, maintenance, insurance, or archive use.',
    href: '/handover',
    action: 'Open handover',
    group: 'Review tools'
  },
  {
    title: 'Sharing',
    description: 'Create expiring invite links and preview role-scoped visibility.',
    href: '/sharing',
    action: 'Open sharing',
    group: 'Review tools'
  },
  {
    title: 'Emergency',
    description: 'Open shutoffs, panels, detectors, and urgent issues in one focused screen.',
    href: '/emergency',
    action: 'Open emergency',
    group: 'Review tools'
  },
  {
    title: 'Professional channel',
    description: 'For agents, inspectors, and property managers — register your business so records you prepare and transfer carry your name.',
    href: '/pro',
    action: 'Open pro channel',
    group: 'Review tools'
  },
  {
    title: 'Settings',
    description: 'Review account state, privacy, security reminders, and development tools.',
    href: '/settings',
    action: 'Open settings',
    group: 'Account'
  },
  {
    title: 'Terms of Service',
    description: 'The terms that govern your use of Our Home Folder.',
    href: '/terms',
    action: 'Read terms',
    group: 'Legal'
  },
  {
    title: 'Privacy Policy',
    description: 'How Our Home Folder handles and protects your information.',
    href: '/privacy',
    action: 'Read privacy policy',
    group: 'Legal'
  }
];

function groupAnchorId(group: string) {
  return group.toLowerCase().replace(/\s+/g, '-');
}

export default function MorePage() {
  const groups = Array.from(new Set(moreLinks.map((link) => link.group)));

  return (
    <>
      <PageHeader
        title="More"
        description="Documents, handover, sharing, emergency, and settings."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Secondary tools</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Handover, Sharing, Emergency, Settings, and Documents live here on mobile so the main workflow stays easy to reach.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UtilityBadge label="Private documents" />
            <UtilityBadge label="Expiring invites" />
            <UtilityBadge label="Emergency view" />
          </div>
        </Card>

        {groups.map((group) => (
          <Card key={group} id={groupAnchorId(group)}>
            <h2 style={{ marginTop: 0 }}>{group}</h2>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {moreLinks
                .filter((link) => link.group === group)
                .map((link) => (
                  <div
                    key={link.href}
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column' }}
                  >
                    <h3 style={{ marginTop: 0 }}>{link.title}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{link.description}</p>
                    {/* Pinned to the card's bottom edge so every action in the row aligns. */}
                    <div style={{ marginTop: 'auto' }}>
                      <ActionLink href={link.href} variant={link.title === 'Documents' ? 'primary' : 'secondary'}>
                        {link.action}
                      </ActionLink>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
