import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { PlateSeal } from '../components/PlateRow';
import { Seo } from '../components/Seo';
import { softwareApplicationSchema } from '../lib/seo';

/* Direction contract — Schedule A, the features page (Persuade), inside the
   committed "Register of Record" world (see styles/globals.css).
   THESIS: the complete enumeration of the instrument, told as the life of a
     home — it refuses the icon-grid features page and the pricing-tier matrix.
   OWN-WORLD: archive green + laid stock, gilt engraving, Cinzel struck titles,
     seals, folios, dotted leaders; unchanged from the committed world.
   STORY: a visitor reads their own future — moving day, the keeping years,
     the 2 a.m. burst pipe, the closing table — finds every capability entered
     as a numbered clause at the moment of life it serves, and begins free.
   FIRST VIEWPORT: engraved cover — "Schedule A", struck title, entry count,
     "Begin your record" primary + demo secondary; schedule of chapters below.
   FORM: lifecycle-of-a-home structure (grounded candidate #5, surface seed
     62be04b2); staging challengers declined for reading clarity. */

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

export default function FeaturesPage() {
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
              marginBottom: 18
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
              fontSize: 'clamp(2rem, 5vw, 3.1rem)',
              margin: '0 0 12px',
              lineHeight: 1.08
            }}
          >
            What the record <span style={{ fontWeight: 500, color: 'var(--color-brass-pale)' }}>holds</span>
          </h1>
          <p style={{ fontSize: 19, maxWidth: 640, marginTop: 0, fontStyle: 'italic' }}>
            Every capability of the instrument, entered as {totalClauses} clauses — in the order a
            home needs them, from the day you move in to the day it changes hands.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 22 }}>
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

      {/* ── Schedule of chapters ──────────────────────────────────────── */}
      <Card>
        <div className="hb-leader" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>The chapters of a home</h2>
          <span style={monoLabel}>Schedule A · Contents</span>
        </div>
        <div style={{ display: 'grid', marginTop: 8 }}>
          {chapters.map((chapter, i) => (
            <a key={chapter.id} href={`#${chapter.id}`} className="hb-toc-row">
              <span className="hb-toc-num">{chapter.num}</span>
              <span className="hb-toc-title">{chapter.title}</span>
              <span className="hb-toc-dots" aria-hidden="true" />
              <span className="hb-folio" style={{ minWidth: '6.2rem', textAlign: 'right' }}>
                {chapter.clauses.length === 1
                  ? `entry ${chapterStarts[i]}`
                  : `entries ${chapterStarts[i]}–${chapterStarts[i] + chapter.clauses.length - 1}`}
              </span>
            </a>
          ))}
        </div>
        <div className="hb-mrz hb-mrz-paper" style={{ marginTop: 14 }} aria-hidden="true">
          SCH·A&lt;&lt;ENTRIES·{totalClauses}&lt;&lt;CH·I–VII&lt;&lt;ISSUED·TO·THE·BEARER
        </div>
      </Card>

      {/* ── The chapters ──────────────────────────────────────────────── */}
      {chapters.map((chapter, i) => (
        <div key={chapter.id} style={{ display: 'contents' }}>
          <Card id={chapter.id} className="cv-section" aria-labelledby={`${chapter.id}-title`}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 6
              }}
            >
              <span className="hb-registry">Chapter {chapter.num}</span>
              <PlateSeal tone={chapter.seal.tone}>{chapter.seal.label}</PlateSeal>
            </div>
            <h2 id={`${chapter.id}-title`} style={{ marginTop: 0, marginBottom: 6 }}>
              {chapter.title}
            </h2>
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 0, maxWidth: 640 }}>
              {chapter.scene}
            </p>
            <ol start={chapterStarts[i]} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
          </Card>

          {/* Mid-schedule attestation — after the chapter read in a panic. */}
          {chapter.id === 'emergency' ? (
            <Card tone="dark" className="cv-section">
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <p style={{ margin: 0, maxWidth: 520, color: 'rgba(244,238,221,0.86)', fontStyle: 'italic' }}>
                  Every entry to this point is in the free register — no card, no trial clock, no
                  feature held back to sell you later.
                </p>
                <ActionLink href="/sign-up">Begin your record — free</ActionLink>
              </div>
            </Card>
          ) : null}
        </div>
      ))}

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
