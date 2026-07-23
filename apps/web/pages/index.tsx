import { Card, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { Seo } from '../components/Seo';
import { organizationSchema, websiteSchema, softwareApplicationSchema } from '../lib/seo';

const contents: { num: string; title: string; detail: string; href: string }[] = [
  { num: 'I', title: 'The Home', detail: 'Rooms · Floors · Map', href: '/home' },
  { num: 'II', title: 'Utilities & Systems', detail: 'Shut-offs · Panels', href: '/utilities' },
  { num: 'III', title: 'Assets & Warranties', detail: 'Appliances · Tools · Inventory', href: '/assets' },
  { num: 'IV', title: 'Care & Maintenance', detail: 'Repairs · Reminders', href: '/maintenance' },
  { num: 'V', title: 'Papers & Receipts', detail: 'Documents · Proof', href: '/documents' },
  { num: 'VI', title: 'The Handover', detail: 'Reports · Sharing', href: '/handover' }
];

export default function Home() {
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Seo
        title="Our Home Folder — a home, documented"
        path="/"
        structuredData={[organizationSchema, websiteSchema, softwareApplicationSchema]}
      />
      <Card tone="dark" className="hb-cover">
        <div className="hb-cover-inner">
          <div style={{ maxWidth: 780 }}>
            <UtilityBadge label="Est. — a home, documented." variant="brassPale" />
            <h1
              style={{
                margin: '22px 0 8px',
                fontSize: 'clamp(2.8rem, 8vw, 4.6rem)',
                lineHeight: 0.98,
                letterSpacing: '-0.03em'
              }}
            >
              Our Home <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--color-brass-pale)' }}>Folder</span>
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(255,248,234,0.6)',
                margin: '0 0 20px'
              }}
            >
              The complete record of the place you live
            </p>
            <p style={{ fontSize: 21, marginTop: 0, maxWidth: 640, fontStyle: 'italic' }}>
              A calm, complete archive of your home — kept the way a family keeps a ledger.
            </p>
            <p style={{ maxWidth: 640 }}>
              Rooms, utilities, documents, receipts, warranties, and care history in one quiet volume.
              Beautiful enough to keep, clear enough to hand on.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
            <ActionLink href="/create-property">Begin your record</ActionLink>
            <ActionLink
              href="/sign-in"
              variant="secondary"
              style={{ color: 'var(--text-inverse)', borderColor: 'rgba(236,226,207,0.42)' }}
            >
              Sign in
            </ActionLink>
          </div>
        </div>
      </Card>

      <Card>
        <div className="hb-leader" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Contents</h2>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)'
            }}
          >
            Six sections
          </span>
        </div>
        <div style={{ display: 'grid', marginTop: 8 }}>
          {contents.map((entry) => (
            <a key={entry.href} href={entry.href} className="hb-toc-row">
              <span className="hb-toc-num">{entry.num}</span>
              <span className="hb-toc-title">{entry.title}</span>
              <span className="hb-toc-dots" aria-hidden="true" />
              <span className="hb-toc-detail">{entry.detail}</span>
            </a>
          ))}
        </div>
      </Card>

      <div className="cv-section" style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Card interactive>
          <h3 style={{ marginTop: 0 }}>Find the important things</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Where is the main water shut-off? Which room has the router? What needs attention next?
          </p>
          <ActionLink href="/home" variant="secondary">Open the home</ActionLink>
        </Card>
        <Card interactive>
          <h3 style={{ marginTop: 0 }}>Keep the record complete</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Documents, receipts, warranties, repairs, and service history stay bound to the home.
          </p>
          <ActionLink href="/dashboard" variant="secondary">Go to the dashboard</ActionLink>
        </Card>
        <Card interactive>
          <h3 style={{ marginTop: 0 }}>Hand it on, one day</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Produce a clean handover for family, a buyer, or a caretaker — without giving away your secrets.
          </p>
          <ActionLink href="/handover" variant="secondary">Preview a handover</ActionLink>
        </Card>
      </div>
    </div>
  );
}
