import type { CSSProperties } from 'react';
import { Card } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { PlateRow, PlateSeal } from '../components/PlateRow';
import { Seo } from '../components/Seo';

/* Schedule of fees — the register's pricing page (Persuade). Same direction
   contract as pages/index.tsx: a fee schedule inside the instrument, not a
   SaaS pricing-card triptych. Every particular below is drawn from the code
   (lib/entitlements.ts FREE_PROPERTY_ALLOWANCE, pages/pro.tsx early-access
   status); Portfolio is $29/mo per docs/PRICING_AND_PLANS.md — if that ruling
   ever changes, change the Stripe Payment Link, the doc, and this page
   together so the page never contradicts the bill. */

const monoLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)'
};

export default function PricingPage() {
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Seo
        title="Pricing — Our Home Folder"
        description="The schedule of fees: your home and one more place free, the Portfolio plan for more properties, and a professional channel for inspectors. No card to begin."
        path="/pricing"
      />

      {/* ── Title leaf ────────────────────────────────────────────────── */}
      <Card tone="dark" className="hb-cover">
        <div className="hb-cover-inner">
          <span className="hb-registry hb-registry-on-dark">Register of record · Appendix</span>
          <h1
            style={{
              fontFamily: 'var(--font-title)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              margin: '10px 0 10px'
            }}
          >
            Schedule of fees
          </h1>
          <p style={{ maxWidth: 620, margin: 0, fontStyle: 'italic' }}>
            A record should cost nothing to begin and nothing to keep for the home you live in.
            The fees below cover the cases beyond that — and every one of them is optional.
          </p>
        </div>
      </Card>

      {/* ── Entry 1 · The free register ───────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="hb-registry">Entry 1 · The Free Register</span>
          <PlateSeal tone="good">No charge</PlateSeal>
        </div>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Your home, and one more place</h2>
            <p style={{ marginBottom: 0 }}>
              The free register covers a homeowner&rsquo;s normal life: the home you live in plus
              one more place — a rental, the cabin, a parent&rsquo;s house. Everything the record
              does is included; nothing is held back to sell it to you later.
            </p>
          </div>
          <div>
            <PlateRow label="Properties" value="Two, complete" />
            <PlateRow label="Rooms · systems · papers" value="Unlimited entries" />
            <PlateRow label="Sharing" value="Invite your household, roles you control" />
            <PlateRow label="Handover & export" value="Included, any time" />
            <PlateRow label="Card required" value="None" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <ActionLink href="/sign-up">Begin your record — free</ActionLink>
        </div>
      </Card>

      {/* ── Entry 2 · The portfolio ───────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="hb-registry">Entry 2 · The Portfolio</span>
          <PlateSeal>Subscription</PlateSeal>
        </div>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>For more places than a life needs</h2>
            <p style={{ marginBottom: 0 }}>
              Landlords and caretakers of several properties keep a register per property —
              tenancies, condition reports, compliance dates, and a clean handover for each. The
              Portfolio plan opens the third property and beyond.
            </p>
          </div>
          <div>
            <PlateRow label="Properties" value="Unlimited" />
            <PlateRow label="Tenancies & compliance" value="Per property" />
            <PlateRow label="Everything in the free register" value="Included" />
            <PlateRow label="Fee" value="$29 a month" />
            <PlateRow label="Cancel" value="Any time — your records remain exportable" />
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 16, marginBottom: 0 }}>
          Begin free; upgrade from inside your account when the third property arrives.
        </p>
      </Card>

      {/* ── Entry 3 · The professional channel ────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="hb-registry">Entry 3 · The Professional Channel</span>
          <PlateSeal tone="good">Free in early access</PlateSeal>
        </div>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>For inspectors and agents</h2>
            <p style={{ marginBottom: 0 }}>
              Issue a buyer their home&rsquo;s living record at closing — not a PDF that goes
              stale in a drawer. Per-binder, one-time pricing, the way inspection add-ons have
              worked for decades; free to the homeowner who receives it, forever.
            </p>
          </div>
          <div>
            <PlateRow label="For the professional" value="Per binder issued, one-time" />
            <PlateRow label="During early access" value="Binders are free" />
            <PlateRow label="For the recipient" value="Free, forever" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <ActionLink href="/pro" variant="secondary">The professional channel</ActionLink>
        </div>
      </Card>

      {/* ── Attestation ───────────────────────────────────────────────── */}
      <Card tone="dark" className="hb-cover">
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
            Most homes never owe a cent
          </h2>
          <p style={{ maxWidth: 540, margin: '0 0 18px', color: 'rgba(244,238,221,0.82)' }}>
            The free register is the product, complete. Begin with the two answers that matter
            most and see for yourself.
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
        </div>
      </Card>

      <p style={{ ...monoLabel, margin: 0, textAlign: 'center' }}>
        Questions about the schedule · support@ourhomefolder.com
      </p>
    </div>
  );
}
