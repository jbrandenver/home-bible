import Link from 'next/link';
import { Button, Card, PageHeader } from '@home-bible/ui';
import { ShortcutLink } from '../components/ShortcutLink';

const maintenanceLinks = [
  {
    title: 'Warranties',
    description: 'See what is covered, what is ending soon, and where the proof lives.',
    href: '/warranties',
    action: 'Open warranties'
  },
  {
    title: 'Receipts',
    description: 'Keep purchase and service receipts close to the things they support.',
    href: '/receipts',
    action: 'Open receipts'
  },
  {
    title: 'Reminders',
    description: 'Remember filters, seasonal work, inspections, and tune-ups before they drift.',
    href: '/reminders',
    action: 'Open reminders'
  },
  {
    title: 'Repairs',
    description: 'Follow open work, scheduled visits, contractors, and completion notes.',
    href: '/repairs',
    action: 'Open repairs'
  },
  {
    title: 'Service History',
    description: 'Review completed tune-ups, inspections, contractor visits, and maintenance history.',
    href: '/repairs',
    action: 'View service history'
  },
  {
    title: 'Issues and Trends',
    description: 'Watch recurring problems, severity, status, and patterns over time.',
    href: '/issues',
    action: 'Open issues'
  }
];

const maintenanceShortcuts = [
  { label: 'Warranties', href: '/warranties' },
  { label: 'Receipts', href: '/receipts' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Repairs', href: '/repairs' },
  { label: 'Service History', href: '/repairs' },
  { label: 'Issues', href: '/issues' },
  { label: 'Trends', href: '/issues' }
];

export default function MaintenanceHubPage() {
  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Care, records, and the things that need attention."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Care, records, and risk tracking</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)' }}>
            Use Maintenance for what needs attention, what has been serviced, what is under warranty, and what risks are emerging.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {maintenanceShortcuts.map((shortcut) => (
              <ShortcutLink
                key={shortcut.label}
                href={shortcut.href}
                label={shortcut.label}
                variant="brassOnDark"
              />
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {maintenanceLinks.map((link) => (
            <Card key={`${link.title}-${link.href}`}>
              <h2 style={{ marginTop: 0 }}>{link.title}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{link.description}</p>
              <Link href={link.href}>
                <Button type="button">{link.action}</Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
