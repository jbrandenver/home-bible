import Link from 'next/link';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';

const maintenanceLinks = [
  {
    title: 'Warranties',
    description: 'Review coverage, expiration dates, manuals, and warranty documents.',
    href: '/warranties',
    action: 'Open warranties'
  },
  {
    title: 'Receipts',
    description: 'Find purchase and service receipts as ownership and maintenance records.',
    href: '/receipts',
    action: 'Open receipts'
  },
  {
    title: 'Reminders',
    description: 'Track recurring care such as filters, seasonal work, inspections, and tune-ups.',
    href: '/reminders',
    action: 'Open reminders'
  },
  {
    title: 'Repairs',
    description: 'Track open repairs, scheduled work, contractors, and completion notes.',
    href: '/repairs',
    action: 'Open repairs'
  },
  {
    title: 'Service History',
    description: 'Review completed tune-ups, inspections, contractor visits, and other maintenance history.',
    href: '/repairs',
    action: 'View service history'
  },
  {
    title: 'Issues and Trends',
    description: 'Watch risks, recurring problems, severity, status, and trend patterns.',
    href: '/issues',
    action: 'Open issues'
  }
];

export default function MaintenanceHubPage() {
  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Ongoing care and ownership records: warranties, receipts, reminders, repairs, service history, issues, and trends."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Care, records, and risk tracking</h2>
          <p style={{ color: '#6b7280' }}>
            Use Maintenance for what needs attention, what has been serviced, what is under warranty, and what risks are emerging.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UtilityBadge label="Warranties" />
            <UtilityBadge label="Receipts" />
            <UtilityBadge label="Reminders" />
            <UtilityBadge label="Repairs" />
            <UtilityBadge label="Service History" />
            <UtilityBadge label="Issues" />
            <UtilityBadge label="Trends" />
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {maintenanceLinks.map((link) => (
            <Card key={`${link.title}-${link.href}`}>
              <h2 style={{ marginTop: 0 }}>{link.title}</h2>
              <p style={{ color: '#6b7280' }}>{link.description}</p>
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
