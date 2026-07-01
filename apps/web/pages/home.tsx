import { Card, PageHeader } from '@home-bible/ui';
import { ActionLink } from '../components/ActionLink';
import { ShortcutLink } from '../components/ShortcutLink';

const homeLinks = [
  {
    title: 'Home Map',
    description: 'See the rooms, floors, and everyday structure of the house.',
    href: '/home-map',
    action: 'Open home map'
  },
  {
    title: 'Rooms',
    description: 'No rooms yet? Map the house one room at a time.',
    href: '/add-rooms',
    action: 'Add rooms'
  },
  {
    title: 'Utilities',
    description: 'Find shutoffs, panels, HVAC, water heater, router, and safety devices quickly.',
    href: '/utilities',
    action: 'Open utilities'
  },
  {
    title: 'Property',
    description: 'Keep the home profile simple. Address is optional.',
    href: '/create-property',
    action: 'Property setup'
  }
];

const utilityShortcuts = [
  { label: 'Main Water Shutoff', href: '/utilities?type=main_water_shutoff' },
  { label: 'Electrical Panel', href: '/utilities?type=electrical_panel' },
  { label: 'Gas Shutoff', href: '/utilities?type=gas_shutoff' },
  { label: 'Water Heater', href: '/utilities?type=water_heater' },
  { label: 'Furnace / HVAC', href: '/utilities?type=hvac' },
  { label: 'Router / Modem', href: '/utilities?type=router_modem' },
  { label: 'Sump Pump', href: '/utilities?type=sump_pump' },
  { label: 'Smoke / Carbon Monoxide Devices', href: '/utilities?type=safety_device' }
];

export default function HomeHubPage() {
  return (
    <>
      <PageHeader
        title="Home"
        description="Where everything in the house lives."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Start here for the house itself</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)' }}>
            Use Home when you need to know where something is, how a room is organized, or where a major utility or home system lives.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {utilityShortcuts.map((shortcut) => (
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
          {homeLinks.map((link) => (
            <Card key={link.href}>
              <h2 style={{ marginTop: 0 }}>{link.title}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{link.description}</p>
              <ActionLink href={link.href} variant={link.href === '/home-map' ? 'primary' : 'secondary'}>
                {link.action}
              </ActionLink>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
