import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { CSSProperties } from 'react';
import { Card } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { BrandMark } from '../components/BrandMark';
import { PlateRow, PlateSeal } from '../components/PlateRow';
import { Seo } from '../components/Seo';
import { getCurrentUser } from '../lib/auth';
import { organizationSchema, websiteSchema, softwareApplicationSchema } from '../lib/seo';

/* Direction contract — marketing landing (Persuade), inside the committed
   "Register of Record" world (see styles/globals.css + x-design-direction meta).
   THESIS: the landing page IS the register, read cover to close — it refuses
     the SaaS hero-features-testimonials scaffold.
   OWN-WORLD: archive green + laid stock, gilt engraving, Cinzel struck titles,
     seals and folios; unchanged from the committed world.
   STORY: a homeowner sees the stranger-in-the-basement problem, watches the
     record answer it, learns the terms, and begins their record.
   FIRST VIEWPORT: engraved cover — mark, struck value line, one italic case,
     "Begin your record" primary + in-browser demo secondary, MRZ.
   FORM: grounded structure #3 (surface seed 9846bb58) — the page as the
     instrument, with its own schedule of contents; staging challengers
     declined for reading clarity. */

// The page's own schedule of contents — the instrument indexes itself.
const contents: { num: string; title: string; detail: string; folio: string; href: string }[] = [
  { num: 'I', title: 'Preamble', detail: 'Why a home needs a record', folio: 'fol. 1', href: '#preamble' },
  { num: 'II', title: 'The Record, Opened', detail: 'Four leaves from a kept home', folio: 'fol. 2', href: '#plates' },
  { num: 'III', title: 'What the Record Holds', detail: 'Schedule A — every capability, entered', folio: 'Sch. A', href: '#schedule' },
  { num: 'IV', title: 'Who Keeps a Record', detail: 'Owners · Households · Professionals', folio: 'fol. 6', href: '#keepers' },
  { num: 'V', title: 'Terms of Keeping', detail: 'Free to begin · Private · Yours', folio: 'fol. 7', href: '#terms' },
  { num: 'VI', title: 'Attestation', detail: 'Begin your record', folio: 'fol. 8', href: '#begin' }
];

const monoLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)'
};

const plateCaption: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
  marginBottom: 0
};

export default function Home() {
  const router = useRouter();

  // The marketing page is for visitors; an account holder who lands on "/"
  // goes to their register instead. Demo-mode (signed-out) browsing stays here.
  useEffect(() => {
    let isMounted = true;
    getCurrentUser().then((user) => {
      if (isMounted && user) {
        router.replace('/dashboard');
      }
    });
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Seo
        title="Our Home Folder — the complete record of the place you live"
        description="A complete record of your home — rooms, shut-offs, appliances, warranties, repairs, and the papers that prove it — drawn up and documented so you and your family are protected. Free to begin."
        path="/"
        structuredData={[organizationSchema, websiteSchema, softwareApplicationSchema]}
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
              marginBottom: 22
            }}
          >
            <span className="hb-registry hb-registry-on-dark">Register of record · Vol. I</span>
            <span className="hb-folio" style={{ color: 'var(--color-brass-pale)' }}>Established by you</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-brass)', flexShrink: 0, marginTop: 6 }} aria-hidden="true">
              <BrandMark size={104} />
            </span>
            <div style={{ maxWidth: 720, minWidth: 'min(100%, 340px)', flex: 1 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-title)',
                  margin: '0 0 14px',
                  fontSize: 'clamp(2rem, 5.4vw, 3.4rem)',
                  lineHeight: 1.06,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}
              >
                The record of the <span style={{ fontWeight: 500, color: 'var(--color-brass-pale)' }}>place you live</span>
              </h1>
              <p style={{ fontSize: 20, marginTop: 0, maxWidth: 640, fontStyle: 'italic' }}>
                Every home is full of answers no one wrote down — where the water shuts off, who
                installed the boiler, whether the roof is still under warranty.
              </p>
              <p style={{ maxWidth: 640 }}>
                Our Home Folder is a complete record of your home — drawn up and documented so you
                and your family are protected. Rooms, systems, appliances, warranties, repairs, and
                the papers that prove it all, in one place.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 26 }}>
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

      {/* ── Schedule of contents (of this page) ───────────────────────── */}
      <Card>
        <div className="hb-leader" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Schedule of contents</h2>
          <span style={monoLabel}>This document</span>
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

      {/* ── I · Preamble ──────────────────────────────────────────────── */}
      <Card id="preamble" className="cv-section">
        <span className="hb-registry" style={{ marginBottom: 10 }}>Section I · Preamble</span>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 8 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>A stranger is standing in your basement</h2>
            <p style={{ marginBottom: 0 }}>
              One day it is a plumber asking which line feeds the hose bib. One day it is a
              house-sitter with a tripped breaker, your partner on the phone with the insurer, a
              buyer&rsquo;s inspector, or the person who inherits the place. They all ask the same
              kind of question — and the answers live in a drawer, an inbox, and the memory of
              whoever handled it last.
            </p>
          </div>
          <div>
            <h2 style={{ marginTop: 0 }}>A home worth keeping deserves a record</h2>
            <p style={{ marginBottom: 0 }}>
              Deeds, logbooks, and service records exist because places outlast the people who
              know them. Our Home Folder gives your home the same instrument: one standing
              register where every room, system, paper, and repair is entered once and findable by
              anyone you hand it to — years later, under pressure, with no one to ask.
            </p>
          </div>
        </div>
      </Card>

      {/* ── II · The record, opened ───────────────────────────────────── */}
      <div id="plates" className="cv-section" style={{ display: 'grid', gap: 20 }}>
        <div className="hb-leader">
          <h2 style={{ margin: 0 }}>The record, opened</h2>
          <span style={monoLabel}>Section II · Four leaves</span>
        </div>

        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
          {/* Plate 1 — Emergency */}
          <Card tone="dark">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className="hb-registry hb-registry-on-dark">Emergency · fol. 7</span>
              <PlateSeal onDark>Recorded</PlateSeal>
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>The night the pipe bursts</h3>
            <PlateRow onDark label="Water main" value="Basement · front wall, left of meter" />
            <PlateRow onDark label="Electrical panel" value="Garage · behind the door" />
            <PlateRow onDark label="Gas valve" value="East side · at the meter" />
            <p style={{ ...plateCaption, color: 'rgba(244,238,221,0.78)', marginTop: 12 }}>
              The emergency sheet is written to be read in a panic, one-handed, by someone who has
              never lived there. Shut-offs and contacts, nothing decorative.
            </p>
          </Card>

          {/* Plate 2 — Assets & warranties */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className="hb-registry">Assets · fol. 12</span>
              <PlateSeal tone="good">Under warranty</PlateSeal>
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>The water heater, on the record</h3>
            <PlateRow label="Entry" value="Rheem Performance 50 · utility closet" />
            <PlateRow label="Installed" value="March 2023 · receipt bound" />
            <PlateRow label="Warranty" value="Through March 2029" />
            <div className="hb-mrz hb-mrz-paper" style={{ marginTop: 12 }} aria-hidden="true">
              RH50-88231&lt;&lt;INST·2023-03&lt;&lt;WARR·2029-03
            </div>
            <p style={{ ...plateCaption, marginTop: 12 }}>
              Every appliance, system, and tool carries its serial, papers, and warranty — so the
              claim gets made instead of missed.
            </p>
          </Card>

          {/* Plate 3 — Care history */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className="hb-registry">Care · fol. 20</span>
              <PlateSeal>Entered</PlateSeal>
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Work that outlives the arrangement</h3>
            <PlateRow label="Nov 2024" value="Furnace serviced · Apex Heating" />
            <PlateRow label="Jun 2025" value="Gutters cleared and resealed" />
            <PlateRow label="Feb 2026" value="Sump pump replaced · under warranty" />
            <p style={{ ...plateCaption, marginTop: 12 }}>
              Repairs, service calls, and reminders stay bound to the rooms and systems they
              belong to — a care history that survives the person who arranged it.
            </p>
          </Card>

          {/* Plate 4 — Handover */}
          <Card tone="dark">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className="hb-registry hb-registry-on-dark">Handover · fol. 31</span>
              <PlateSeal onDark>Issued</PlateSeal>
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Issued to the next keeper</h3>
            <p style={{ color: 'rgba(244,238,221,0.82)' }}>
              When the day comes, produce a clean handover copy for family, a buyer, or a
              caretaker — the whole record, legible to someone who was never there, with your
              private notes kept back.
            </p>
            <PlateRow onDark label="Issued to" value="The bearer" />
            <PlateRow onDark label="Contains" value="Everything they need · nothing they don't" />
            <p style={{ ...plateCaption, color: 'rgba(244,238,221,0.78)', marginTop: 12 }}>
              This is the point of the whole instrument: a record one person keeps and another
              person can read.
            </p>
          </Card>
        </div>
        <p style={{ ...monoLabel, margin: 0 }}>Entries shown are illustrative.</p>
      </div>

      {/* ── III · Schedule A, in brief ────────────────────────────────── */}
      <Card id="schedule" className="cv-section">
        <div className="hb-leader" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>What the record holds</h2>
          <span style={monoLabel}>Section III · Schedule A</span>
        </div>
        <p style={{ color: 'var(--text-muted)', maxWidth: 640, marginTop: 8 }}>
          The four leaves above are a sample. The full schedule enumerates every capability of the
          instrument, chapter by chapter, in the order a home needs them.
        </p>
        <div style={{ display: 'grid', marginTop: 4 }}>
          {[
            { num: 'I', title: 'The Day You Begin', detail: 'Home map · guided first entries · completeness', href: '/features#begin' },
            { num: 'II', title: 'The Years of Keeping', detail: 'Inventory · warranties · repairs · reminders · recalls', href: '/features#keeping' },
            { num: 'III', title: 'The Wired Home', detail: 'Devices · networks · automations · the failure check', href: '/features#wired' },
            { num: 'IV', title: 'The Night It Goes Wrong', detail: 'The emergency sheet, on any phone', href: '/features#emergency' },
            { num: 'V', title: 'The People Who Share It', detail: 'Roles · view-only access · private entries', href: '/features#sharing' },
            { num: 'VI', title: 'The Day It Changes Hands', detail: 'Handover pack · export · the professional channel', href: '/features#handover' },
            { num: 'VII', title: 'More Than One Home', detail: 'Tenancies · condition reports · compliance', href: '/features#portfolio' }
          ].map((chapter) => (
            <Link key={chapter.href} href={chapter.href} className="hb-toc-row">
              <span className="hb-toc-num">{chapter.num}</span>
              <span className="hb-toc-title">{chapter.title}</span>
              <span className="hb-toc-dots" aria-hidden="true" />
              <span className="hb-toc-detail">{chapter.detail}</span>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <ActionLink href="/features" variant="secondary">Read the full schedule — every entry</ActionLink>
        </div>
      </Card>

      {/* ── IV · Who keeps one ────────────────────────────────────────── */}
      <Card id="keepers" className="cv-section">
        <div className="hb-leader" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Who keeps a record</h2>
          <span style={monoLabel}>Section IV</span>
        </div>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Homeowners</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Start with the two answers most owners don&rsquo;t have — where the water shuts off
              and where the panel is — and let the record grow with every repair and receipt.
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Households</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Share the register with a partner, family, or a house-sitter with roles you control
              — so the knowledge belongs to the home, not to whoever happens to be there.
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--gilt-line)', paddingTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Landlords &amp; professionals</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
              Keep a register per property — <Link href="/features#portfolio">tenancies, condition
              reports, compliance dates</Link> — and hand each one over intact when it changes
              hands. Inspectors and agents issue records through{' '}
              <Link href="/pro">the professional channel</Link>.
            </p>
          </div>
        </div>
      </Card>

      {/* ── V · Terms of keeping ──────────────────────────────────────── */}
      <Card id="terms" className="cv-section">
        <div className="hb-leader" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Terms of keeping</h2>
          <span style={monoLabel}>Section V</span>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <PlateRow label="Free to begin" value="The home you live in, free forever — no card to start" />
          <PlateRow label="Private by design" value="Your record is yours; sharing is by your invitation only" />
          <PlateRow label="Yours to take" value="Export everything, any time, in open formats" />
          <PlateRow label="Try before you commit" value="The in-browser demo keeps its data on your device" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 14, marginBottom: 0 }}>
          The particulars are written down like everything else here — see{' '}
          <Link href="/pricing">the schedule of fees</Link>,{' '}
          <Link href="/data-promise">our data promise</Link>, and the{' '}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </Card>

      {/* ── VI · Attestation ──────────────────────────────────────────── */}
      <Card id="begin" tone="dark" className="hb-cover cv-section">
        <div className="hb-cover-inner" style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 4 }}>
          <span className="hb-registry hb-registry-on-dark">Section VI · Attestation</span>
          <h2
            style={{
              fontFamily: 'var(--font-title)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              margin: '10px 0 8px'
            }}
          >
            Begin your record
          </h2>
          <p style={{ maxWidth: 560, margin: '0 0 18px', color: 'rgba(244,238,221,0.82)' }}>
            Ten minutes to enter the two answers that matter most. A record your home keeps from
            then on.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <ActionLink href="/sign-up">Begin your record — free</ActionLink>
            <ActionLink
              href="/sign-in"
              variant="secondary"
              style={{ color: 'var(--text-inverse)', borderColor: 'rgba(227,194,136,0.56)' }}
            >
              Sign in
            </ActionLink>
          </div>
        </div>
      </Card>
    </div>
  );
}
