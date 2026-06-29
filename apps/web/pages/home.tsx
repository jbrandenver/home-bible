import Link from 'next/link';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';

const homeLinks = [
  {
    title: 'Home Map',
    description: 'See rooms, floors, and the physical layout you have entered.',
    href: '/home-map',
    action: 'Open home map'
  },
  {
    title: 'Rooms',
    description: 'Add rooms and keep the structure of the home easy to scan.',
    href: '/add-rooms',
    action: 'Add rooms'
  },
  {
    title: 'Utilities',
    description: 'Track shutoffs, panels, HVAC, water heater, router, and safety devices.',
    href: '/utilities',
    action: 'Open utilities'
  },
  {
    title: 'Property',
    description: 'Create or update the basic home profile. Address is optional.',
    href: '/create-property',
    action: 'Property setup'
  }
];

const utilityExamples = [
  'Main water shutoff',
  'Electrical panel',
  'Gas shutoff',
  'Water heater',
  'Furnace / HVAC',
  'Router / modem',
  'Sump pump',
  'Smoke and carbon monoxide devices'
];

export default function HomeHubPage() {
  return (
    <>
      <PageHeader
        title="Home"
        description="The physical structure of the home: property, rooms, map, utilities, shutoffs, panels, and home systems."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Start here for the house itself</h2>
          <p style={{ color: '#6b7280' }}>
            Use Home when you are looking for where something is, how a room is organized, or where a major utility or home system lives.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {utilityExamples.map((label) => (
              <UtilityBadge key={label} label={label} />
            ))}
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {homeLinks.map((link) => (
            <Card key={link.href}>
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
