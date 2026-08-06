import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { PlateRow, PlateSeal } from '../components/PlateRow';
import { Seo } from '../components/Seo';
import { softwareApplicationSchema } from '../lib/seo';

/* Direction contract — Schedule A, the features page (Persuade), inside the
   committed "Register of Record" world (see styles/globals.css).
   THESIS: a selling page, not a reading page — five specimen blocks (one
     headline, one line, one plate each) prove the record at work; the full
     enumeration survives as folded bars with keyword previews. It refuses
     the icon grid, the wall of text, and paragraphs anywhere.
   OWN-WORLD: archive green + laid stock, gilt engraving, Cinzel struck titles,
     seals, folios, dotted leaders; unchanged from the committed world.
   STORY: a visitor reads five headlines, sees the product doing its job in
     the plates, finds their door (owner / landlord / inspector), and begins
     free; the 36 entries are scannable, never required reading.
   FIRST VIEWPORT: compact cover — struck title, one italic line, mono stat
     strip (entries · $0 · 10 minutes), primary + demo CTAs — first seller
     block cresting beneath.
   FORM: lifecycle-of-a-home structure (grounded candidate #5, surface seed
     62be04b2), recomposed 2026-08-06 to seller blocks + folded schedule on
     Jesse's direction (density discipline per market research; plates are
     the screenshot slots until real captures land). */

type Clause = {
  name: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

type Chapter = {
  id: string;
  num: string;
  title: string;
  benefit: string;
  scene: string;
  seal: { label: string; tone: 'good' | 'attention' };
  clauses: Clause[];
};

// The full schedule. Every clause below is a shipped capability — nothing
// aspirational belongs in this list. Numbering is continuous and computed.
const chapters: Chapter[] = [
  {
    id: 'begin',
    num: 'I',
    title: 'The Day You Begin',
    benefit: 'Ten minutes, two entries — the record opens with the answers nobody can find.',
    scene:
      'Moving day, or twenty years in — the record opens the same way: with the answers nobody can find.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'The home map',
        detail:
          'Floors, then rooms, then everything in them — each entry kept in the place it actually lives.'
      },
      {
        name: 'Guided first entries',
        detail:
          'The record opens with the two things nobody can find: where the water shuts off and where the electrical panel is. Ten minutes, and the worst night already goes better.'
      },
      {
        name: 'Rooms with photographs',
        detail:
          'Every room is its own leaf — photos, notes, and whatever the room holds, filed against it.'
      },
      {
        name: 'The completeness score',
        detail:
          'A quiet measure of what is on record and what is still missing, weighted toward the entries an emergency or a warranty claim would need first.'
      },
      {
        name: 'The in-browser demo',
        detail: 'Walk the whole instrument before you sign up. Demo data never leaves your device.',
        href: '/welcome',
        hrefLabel: 'Try it'
      }
    ]
  },
  {
    id: 'keeping',
    num: 'II',
    title: 'The Years of Keeping',
    benefit: 'The paper trail an insurer, a buyer, or a warranty claim will one day ask for.',
    scene:
      'The slow decades of ownership — a receipt here, a service call there — entered once, findable forever.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'The inventory',
        detail:
          'Utilities, appliances, accessories, smart devices, and tools — everything the house owns, on one register, down to the Tool Shed.'
      },
      {
        name: 'Makes, models, and serials',
        detail:
          'The particulars that warranty claims and safety recalls turn on, carried on every entry.'
      },
      {
        name: 'Warranties',
        detail:
          'Terms and expiry dates bound to the appliance and to the receipt that proves them — so the claim gets made instead of missed.'
      },
      {
        name: 'Receipts',
        detail: 'Purchase records filed against the things they bought, not lost in an inbox.'
      },
      {
        name: 'Documents',
        detail:
          'Manuals, closing papers, insurance, permits — the home’s paper, kept where the next person can find it.'
      },
      {
        name: 'Repairs & service history',
        detail:
          'Who came, when, and what was done — bound to the room or system it served, a care history that survives the person who arranged it.'
      },
      {
        name: 'The service call sheet',
        detail:
          'A one-page sheet to hand a tradesperson at the door: access, shut-offs, and the history of the fault.'
      },
      {
        name: 'Maintenance & reminders',
        detail:
          'The recurring care a house asks for, with due dates that do not depend on anyone’s memory.'
      },
      {
        name: 'The reminder digest',
        detail:
          'A quiet email of what is coming due. No streaks, no nagging — a ledger line, delivered.'
      },
      {
        name: 'Issues & trends',
        detail:
          'The problems that keep coming back, tracked long enough to see the pattern behind them.'
      },
      {
        name: 'The recall watch',
        detail:
          'Recorded appliances are checked against CPSC safety-recall listings, and exact matches surface on the record. Conservative by design — no false alarms.'
      }
    ]
  },
  {
    id: 'wired',
    num: 'III',
    title: 'The Wired Home',
    benefit: 'The smart home written down — so the house stops depending on the one person who set it up.',
    scene:
      'Every smart home has one person who understands it. The record is how the house stops depending on them.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'Smart devices',
        detail:
          'What each device is, where it lives, and which app and account run it — written down, not remembered.'
      },
      {
        name: 'Hubs & controllers',
        detail: 'The boxes everything else depends on, recorded before they are forgotten.'
      },
      {
        name: 'Networks',
        detail: 'The networks the house runs on, and which devices ride on each.'
      },
      {
        name: 'Automations & scenes',
        detail:
          'What is automated and why, in plain words the next person can read — not buried in an app.'
      },
      {
        name: 'The connection map',
        detail: 'What talks to what, drawn as a map instead of held in one person’s head.'
      },
      {
        name: 'The failure check',
        detail:
          'Ask “what stops working if this fails?” and get the honest list — before you unplug it.'
      }
    ]
  },
  {
    id: 'emergency',
    num: 'IV',
    title: 'The Night It Goes Wrong',
    benefit: 'Shut-offs and contacts on one sheet, readable in a panic, on any phone.',
    scene:
      'A burst pipe at 2 a.m., a house-sitter with a tripped breaker. This chapter is written to be read in a panic.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'The emergency sheet',
        detail:
          'Shut-offs and contacts on one sheet, readable one-handed by someone who has never lived there. Nothing decorative.'
      },
      {
        name: 'On any phone, at the door',
        detail:
          'The record opens anywhere a browser does and installs to a phone’s home screen — for the person standing in your basement, not at your desk.'
      }
    ]
  },
  {
    id: 'sharing',
    num: 'V',
    title: 'The People Who Share It',
    benefit: 'Partner, family, house-sitter — invited by email, with roles you set and revoke.',
    scene:
      'The knowledge should belong to the home — not to whoever happens to be standing in it.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'Household sharing',
        detail:
          'Invite a partner, family, or a house-sitter by email. Reading your record never costs them anything.'
      },
      {
        name: 'Roles & view-only access',
        detail:
          'Who can edit and who can only read is yours to set — and yours to revoke, the moment it should end.'
      },
      {
        name: 'Entry-by-entry visibility',
        detail:
          'Documents and assets are marked for the contexts they belong to — family, buyer, maintenance, insurance, or your personal archive.'
      }
    ]
  },
  {
    id: 'handover',
    num: 'VI',
    title: 'The Day It Changes Hands',
    benefit: 'A sale, an inheritance, a caretaker — the record moves with the house, in open formats.',
    scene:
      'A sale, an inheritance, a caretaker taking over. The point of the whole instrument is this day.',
    seal: { label: 'Free register', tone: 'good' },
    clauses: [
      {
        name: 'The handover pack',
        detail:
          'The whole record, produced as a clean print or PDF copy — legible to someone who was never there.'
      },
      {
        name: 'Export, in open formats',
        detail:
          'Everything you entered, out whenever you ask, in formats any tool can read. The record is yours, not ours.'
      },
      {
        name: 'Claiming a record',
        detail:
          'A record issued to you — by an inspector, an agent, or the previous keeper — becomes your own register when you claim it.'
      },
      {
        name: 'The professional channel',
        detail:
          'Inspectors and agents issue a buyer their home’s living record at closing — not a PDF that goes stale in a drawer. Free, forever, for the homeowner who receives it.',
        href: '/pro',
        hrefLabel: 'For professionals'
      }
    ]
  },
  {
    id: 'portfolio',
    num: 'VII',
    title: 'More Than One Home',
    benefit: 'A register per rental: condition reports, compliance dates, tenancies — the paper trail.',
    scene:
      'The cabin, a rental, a parent’s house — each place keeps its own complete register.',
    seal: { label: 'Beyond the first home', tone: 'attention' },
    clauses: [
      {
        name: 'A register per property',
        detail:
          'Every additional home gets the same complete record as your first — nothing abridged.'
      },
      {
        name: 'Tenancies',
        detail: 'Who holds the place, from when to when — each tenancy on the record.'
      },
      {
        name: 'Condition reports',
        detail: 'The state of the place, recorded room by room with photographs, at move-in and after.'
      },
      {
        name: 'Compliance',
        detail: 'The certificates and inspections a rental must keep current, with their dates.'
      },
      {
        name: 'The portfolio view',
        detail: 'Every property on one page, so nothing quietly lapses.'
      }
    ]
  }
];

// Continuous clause numbering across the whole schedule.
const chapterStarts = chapters.reduce<number[]>((starts, chapter, i) => {
  starts.push(i === 0 ? 1 : starts[i - 1] + chapters[i - 1].clauses.length);
  return starts;
}, []);
const totalClauses = chapters.reduce((n, c) => n + c.clauses.length, 0);

const entriesLabel = (i: number): string =>
  chapters[i].clauses.length === 1
    ? `entry ${chapterStarts[i]}`
    : `entries ${chapterStarts[i]}–${chapterStarts[i] + chapters[i].clauses.length - 1}`;

const featuresApplicationSchema = {
  ...softwareApplicationSchema,
  featureList: chapters.flatMap((c) => c.clauses.map((cl) => cl.name))
};

const monoLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)'
};

const keywordLine: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-brass-deep)',
  lineHeight: 1.7
};

export default function FeaturesPage() {
  // A chapter linked by hash (from the landing page or the plan) unfolds
  // itself; everything else stays folded so the schedule reads at a glance.
  useEffect(() => {
    const applyHash = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Seo
        title="Features — Our Home Folder"
        description={`All ${totalClauses} features of Our Home Folder, in the order a home needs them: home inventory, warranties and receipts, maintenance reminders, repair history, smart-home documentation, an emergency sheet, household sharing, landlord tools, and a handover pack. Free to begin.`}
        path="/features"
        structuredData={[featuresApplicationSchema]}
      />

      {/* ── Cover ─────────────────────────────────────────────────────── */}
      <Card tone="dark" className="hb-cover">
        <div className="hb-cover-inner">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            <span className="hb-registry hb-registry-on-dark">Register of record · Schedule A</span>
            <span className="hb-folio" style={{ color: 'var(--color-brass-pale)' }}>
              {totalClauses} entries
            </span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-title)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              fontSize: 'clamp(1.9rem, 4.6vw, 2.9rem)',
              margin: '0 0 10px',
              lineHeight: 1.08
            }}
          >
            What the record <span style={{ fontWeight: 500, color: 'var(--color-brass-pale)' }}>holds</span>
          </h1>
          <p style={{ fontSize: 19, maxWidth: 560, marginTop: 0, marginBottom: 0, fontStyle: 'italic' }}>
            Everything your home knows, kept for whoever needs it next.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '10px 28px',
              flexWrap: 'wrap',
              marginTop: 18,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-brass-pale)'
            }}
          >
            <a href="#schedule" style={{ color: 'inherit', textDecoration: 'none' }}>
              {totalClauses} entries · 7 chapters ↓
            </a>
            <span>$0 — the home you live in</span>
            <span>10 minutes to begin</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 20 }}>
            <ActionLink href="/sign-up">Begin your record — free</ActionLink>
            <ActionLink
              href="/welcome"
              variant="secondary"
              style={{ color: 'var(--text-inverse)', borderColor: 'rgba(227,194,136,0.56)' }}
            >
              Try it in this browser
            </ActionLink>
            <span style={{ fontSize: '0.88rem', color: 'rgba(244,238,221,0.72)', fontStyle: 'italic' }}>
              No card. The demo keeps its data on your device.
            </span>
          </div>
        </div>
      </Card>

      {/* ── The sellers — five blocks, one line each ──────────────────── */}
      {/* Text + specimen plate, alternating grounds. The plate column is
          the screenshot slot: swap each inner leaf for a real product
          screenshot when captures exist. Entries shown are illustrative. */}

      {/* 1 · Reminders — the recurring-value engine */}
      <Card className="cv-section">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'center' }}>
          <div>
            <span className="hb-registry" style={{ marginBottom: 10 }}>Chapter II · Maintenance</span>
            <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              The house reminds you
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
              Recurring care and expiry dates surface when they're due — on the record, and in a
              quiet weekly email.
            </p>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '16px 18px', background: 'var(--surface-page)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={monoLabel}>This week at home</span>
              <PlateSeal tone="good">On watch</PlateSeal>
            </div>
            <PlateRow label="Sat" value="Clear gutters · fall sweep" />
            <PlateRow label="Due" value="Furnace filter · 90 days since last" />
            <PlateRow label="Mar" value="Water heater warranty · 90 days left" />
          </div>
        </div>
      </Card>

      {/* 2 · Warranties — the dollar story */}
      <Card tone="dark" className="cv-section">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'center' }}>
          <div>
            <span className="hb-registry hb-registry-on-dark" style={{ marginBottom: 10 }}>Chapter II · Warranties &amp; receipts</span>
            <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              The claim gets made
            </h2>
            <p style={{ color: 'rgba(244,238,221,0.82)', margin: 0, maxWidth: 440 }}>
              Serial, receipt, and expiry live on one entry — so the warranty pays instead of
              quietly lapsing.
            </p>
          </div>
          <div style={{ border: '1px solid rgba(227,194,136,0.4)', borderRadius: 'var(--radius-card)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="hb-registry hb-registry-on-dark">Water heater · fol. 12</span>
              <PlateSeal onDark>Under warranty</PlateSeal>
            </div>
            <PlateRow onDark label="Entry" value="Rheem Performance 50" />
            <PlateRow onDark label="Installed" value="March 2023 · receipt bound" />
            <PlateRow onDark label="Warranty" value="Through March 2029" />
          </div>
        </div>
      </Card>

      {/* 3 · Emergency — the signature */}
      <Card className="cv-section">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'center' }}>
          <div>
            <span className="hb-registry" style={{ marginBottom: 10 }}>Chapter IV · Emergency</span>
            <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              Readable in a panic
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
              Shut-offs and contacts on one sheet, on any phone — for whoever is standing in your
              basement.
            </p>
          </div>
          <div style={{ maxWidth: 340, justifySelf: 'center', width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-card)', padding: '16px 18px', background: 'var(--color-green-deep)', color: 'var(--text-inverse)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="hb-registry hb-registry-on-dark">Emergency</span>
              <PlateSeal onDark>Recorded</PlateSeal>
            </div>
            <PlateRow onDark label="Water" value="Basement · left of meter" />
            <PlateRow onDark label="Panel" value="Garage · behind the door" />
            <PlateRow onDark label="Gas" value="East side · at the meter" />
          </div>
        </div>
      </Card>

      {/* 4 · Handover — the differentiator */}
      <Card tone="dark" className="cv-section">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'center' }}>
          <div>
            <span className="hb-registry hb-registry-on-dark" style={{ marginBottom: 10 }}>Chapter VI · Handover</span>
            <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              The house comes with its manual
            </h2>
            <p style={{ color: 'rgba(244,238,221,0.82)', margin: 0, maxWidth: 440 }}>
              The whole record — print, PDF, or export — legible to family, a buyer, or the next
              keeper.
            </p>
          </div>
          <div style={{ border: '1px solid rgba(227,194,136,0.4)', borderRadius: 'var(--radius-card)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="hb-registry hb-registry-on-dark">Handover · fol. 31</span>
              <PlateSeal onDark>Issued</PlateSeal>
            </div>
            <PlateRow onDark label="Issued to" value="The bearer" />
            <PlateRow onDark label="Contains" value="Everything they need" />
            <PlateRow onDark label="Format" value="Print · PDF · open export" />
          </div>
        </div>
      </Card>

      {/* 5 · Landlords — the paid tier */}
      <Card className="cv-section">
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'center' }}>
          <div>
            <span className="hb-registry" style={{ marginBottom: 10 }}>Chapter VII · The Portfolio</span>
            <h2 style={{ marginTop: 8, marginBottom: 8, fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
              Evidence that holds up
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: 440 }}>
              Condition reports with photographs, compliance dates, tenancies — a register per
              property.
            </p>
            <ActionLink href="/pricing" variant="secondary">The schedule of fees</ActionLink>
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '16px 18px', background: 'var(--surface-page)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={monoLabel}>Unit 2B · move-in report</span>
              <PlateSeal>Beyond the first home</PlateSeal>
            </div>
            <PlateRow label="Kitchen" value="12 photographs · March 1" />
            <PlateRow label="Gas certificate" value="Renews June" />
            <PlateRow label="Tenancy" value="March 2026 — present" />
          </div>
        </div>
      </Card>

      <p style={{ ...monoLabel, margin: 0 }}>Entries shown are illustrative.</p>

      {/* ── Three readers, one line each ──────────────────────────────── */}
      <Card className="cv-section">
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>Homeowners &amp; families</h3>
            <Link href="/sign-up" className="hb-folio" style={{ textDecoration: 'none' }}>Begin free →</Link>
          </div>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>Landlords</h3>
            <Link href="/pricing" className="hb-folio" style={{ textDecoration: 'none' }}>The Portfolio →</Link>
          </div>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>Inspectors &amp; agents</h3>
            <Link href="/pro" className="hb-folio" style={{ textDecoration: 'none' }}>Issue at closing →</Link>
          </div>
        </div>
      </Card>

      {/* ── The full schedule, folded ─────────────────────────────────── */}
      <div id="schedule" className="cv-section" style={{ display: 'grid', gap: 14 }}>
        <div className="hb-leader">
          <h2 style={{ margin: 0 }}>The full schedule</h2>
          <span style={monoLabel}>{totalClauses} entries · unfold a chapter</span>
        </div>

        {chapters.map((chapter, i) => (
          <details key={chapter.id} id={chapter.id} className="hb-card hb-chapter">
            <summary className="hb-chapter-summary">
              <span className="hb-toc-num" style={{ minWidth: '2rem' }}>{chapter.num}</span>
              <span className="hb-toc-title">{chapter.title}</span>
              <span className="hb-toc-dots" aria-hidden="true" />
              <span className="hb-folio" style={{ whiteSpace: 'nowrap' }}>
                {entriesLabel(i)} <span className="hb-chapter-caret" aria-hidden="true">▸</span>
              </span>
              <span
                className="hb-chapter-kw"
                style={{
                  ...keywordLine,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  flexBasis: '100%',
                  paddingLeft: '2.75rem'
                }}
              >
                {chapter.clauses.map((cl) => cl.name.replace(/^The /, '')).join(' · ')}
              </span>
            </summary>
            <div style={{ paddingTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap'
                }}
              >
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', margin: 0, maxWidth: 640 }}>
                  {chapter.scene}
                </p>
                <PlateSeal tone={chapter.seal.tone}>{chapter.seal.label}</PlateSeal>
              </div>
              <ol start={chapterStarts[i]} style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {chapter.clauses.map((clause, j) => (
                  <li
                    key={clause.name}
                    style={{
                      borderTop: '1px solid var(--gilt-line)',
                      padding: '0.7rem 0',
                      display: 'grid',
                      gridTemplateColumns: '3.2rem 1fr',
                      gap: '0.75rem',
                      alignItems: 'baseline'
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        color: 'var(--color-brass-deep)'
                      }}
                    >
                      No. {chapterStarts[i] + j}
                    </span>
                    <span>
                      <strong style={{ display: 'block', fontSize: '1.02rem', marginBottom: 2 }}>
                        {clause.name}
                      </strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        {clause.detail}
                        {clause.href ? (
                          <>
                            {' '}
                            <Link href={clause.href}>{clause.hrefLabel}</Link>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              {chapter.id === 'portfolio' ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 14, marginBottom: 0 }}>
                  The home you live in is free forever. Additional homes and the Portfolio plan are
                  set out in <Link href="/pricing">the schedule of fees</Link>.
                </p>
              ) : null}
            </div>
          </details>
        ))}

        <div className="hb-mrz hb-mrz-paper" aria-hidden="true">
          SCH·A&lt;&lt;ENTRIES·{totalClauses}&lt;&lt;CH·I–VII&lt;&lt;ISSUED·TO·THE·BEARER
        </div>
      </div>

      {/* ── Attestation ───────────────────────────────────────────────── */}
      <Card tone="dark" className="hb-cover cv-section">
        <div className="hb-cover-inner" style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 4 }}>
          <span className="hb-registry hb-registry-on-dark">Attestation</span>
          <h2
            style={{
              fontFamily: 'var(--font-title)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontSize: 'clamp(1.5rem, 3.6vw, 2.2rem)',
              margin: '10px 0 8px'
            }}
          >
            {totalClauses} entries. One record.
          </h2>
          <p style={{ maxWidth: 560, margin: '0 0 18px', color: 'rgba(244,238,221,0.82)' }}>
            It begins with the two answers that matter most — where the water shuts off, and where
            the panel is. The rest accrues, one entry at a time, to whoever comes after you.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <ActionLink href="/sign-up">Begin your record — free</ActionLink>
            <ActionLink
              href="/welcome"
              variant="secondary"
              style={{ color: 'var(--text-inverse)', borderColor: 'rgba(227,194,136,0.56)' }}
            >
              Try it in this browser
            </ActionLink>
          </div>
          <p style={{ ...monoLabel, marginTop: 16, marginBottom: 0 }}>
            <Link href="/pricing" style={{ color: 'inherit' }}>Schedule of fees</Link>
            {' · '}
            <Link href="/data-promise" style={{ color: 'inherit' }}>Our data promise</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
