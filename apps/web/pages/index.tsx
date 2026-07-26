import { Card, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { Seo } from '../components/Seo';
import { organizationSchema, websiteSchema, softwareApplicationSchema } from '../lib/seo';

const contents: { num: string; title: string; detail: string; folio: string; href: string }[] = [
  { num: 'I', title: 'The Home', detail: 'Rooms · Floors · Map', folio: 'fol. 1', href: '/home' },
  { num: 'II', title: 'Utilities & Systems', detail: 'Shut-offs · Panels', folio: 'fol. 7', href: '/utilities' },
  { num: 'III', title: 'Assets & Warranties', detail: 'Appliances · Tools · Inventory', folio: 'fol. 12', href: '/assets' },
  { num: 'IV', title: 'Care & Maintenance', detail: 'Repairs · Reminders', folio: 'fol. 20', href: '/maintenance' },
  { num: 'V', title: 'Papers & Receipts', detail: 'Documents · Proof', folio: 'fol. 26', href: '/documents' },
  { num: 'VI', title: 'The Handover', detail: 'Reports · Sharing', folio: 'fol. 31', href: '/handover' }
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
          <div style={{ maxWidth: 800 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 18
              }}
            >
              <span className="hb-registry hb-registry-on-dark">Register of record · Vol. I</span>
              <span className="hb-folio" style={{ color: 'var(--color-brass-pale)' }}>Est. — a home, documented</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-title)',
                margin: '4px 0 12px',
                fontSize: 'clamp(2.4rem, 7vw, 4rem)',
                lineHeight: 1.02,
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}
            >
              Our Home <span style={{ fontWeight: 500, color: 'var(--color-brass-pale)' }}>Folder</span>
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(244,238,221,0.62)',
                margin: '0 0 20px'
              }}
            >
              The complete record of the place you live
            </p>
            <p style={{ fontSize: 21, marginTop: 0, maxWidth: 640, fontStyle: 'italic' }}>
              A calm, complete record of your home — drawn up the way a family keeps a deed.
            </p>
            <p style={{ maxWidth: 640 }}>
              Rooms, utilities, documents, receipts, warranties, and care history entered in one
              standing instrument. Beautiful enough to keep, clear enough to hand on.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
            <ActionLink href="/create-property">Begin your record</ActionLink>
            <ActionLink
              href="/sign-in"
              variant="secondary"
              style={{ color: 'var(--text-inverse)', borderColor: 'rgba(227,194,136,0.42)' }}
            >
              Sign in
            </ActionLink>
          </div>
          <div className="hb-mrz" style={{ marginTop: 26, maxWidth: 640 }} aria-hidden="true">
            OUR·HOME·FOLDER&lt;&lt;A·COMPLETE·RECORD&lt;&lt;KEEP&lt;&lt;HAND·ON&lt;&lt;OHF
          </div>
        </div>
      </Card>

      <Card>
        <div className="hb-leader" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Schedule of contents</h2>
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
              <span className="hb-folio" style={{ minWidth: '3.4rem', textAlign: 'right' }}>{entry.folio}</span>
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
