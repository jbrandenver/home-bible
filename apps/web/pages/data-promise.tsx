import Link from 'next/link';
import { Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { Seo } from '../components/Seo';

const EFFECTIVE_DATE = 'July 30, 2026';

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h2 style={{ marginBottom: 8 }}>{heading}</h2>
      <div style={{ color: 'var(--text-primary)', display: 'grid', gap: 10 }}>{children}</div>
    </section>
  );
}

export default function DataPromisePage() {
  return (
    <>
      <Seo
        title="Our Data Promise — Our Home Folder"
        description="Your home record is yours: full export with files included, always, and a 90-day guarantee if this service ever winds down."
        path="/data-promise"
      />
      <PageHeader
        eyebrow={`A standing commitment · ${EFFECTIVE_DATE}`}
        title="Our Data Promise"
        description="A home record is meant to outlive the software it was written in. This page says what that means in practice."
      >
        <ActionLink href="/privacy" variant="secondary">Privacy Policy</ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 20, maxWidth: 820 }}>
        <Card>
          <p style={{ marginTop: 0, marginBottom: 0 }}>
            This is not a legal document. It is a short list of promises about your data,
            written to be held against. The <Link href="/terms" style={{ color: 'var(--color-brass-deep)' }}>Terms</Link> and{' '}
            <Link href="/privacy" style={{ color: 'var(--color-brass-deep)' }}>Privacy Policy</Link> say what we may do;
            this page says what we will do.
          </p>
        </Card>

        <Card>
          <Section heading="1. Your record is yours">
            <p style={{ margin: 0 }}>
              You can take a complete copy of everything, whenever you want, in one click
              from <Link href="/settings" style={{ color: 'var(--color-brass-deep)' }}>Settings</Link>. Not a
              spreadsheet of names and dates — everything: every record, every note, and
              every file you uploaded, photos and manuals included, packaged in one archive
              in open formats. It is unredacted, because it is your data going to your own
              device. No export fee, no waiting period, no support ticket.
            </p>
          </Section>

          <Section heading="2. If this service ever winds down">
            <p style={{ margin: 0 }}>
              We intend to keep this running for a very long time. But a promise that only
              works while things go well is not a promise, so here is the other half:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>You will get <strong>at least 90 days notice</strong> before anything shuts down.</li>
              <li>The full export — files and photos included — <strong>stays available for that entire period</strong>.</li>
              <li>We will provide a bulk download of everything you have stored, not just tables.</li>
              <li><strong>We will never delete your data without that notice.</strong> Ever.</li>
            </ul>
          </Section>

          <Section heading="3. Why we promise this">
            <p style={{ margin: 0 }}>
              This category has a history. A well-funded home-inventory app — one many
              families trusted with years of photos and appliance records — shut down and
              gave its users a short window to download spreadsheets. The photos were not
              part of the export. When the window closed, they were gone.
            </p>
            <p style={{ margin: 0 }}>
              We think that is the single worst thing a product like this can do, and the
              question it left behind — <em>will you disappear too?</em> — deserves a
              structural answer, not a reassuring one. The answer is above: the complete
              export exists today, it includes your files, and the wind-down guarantee is
              written down where you can point at it.
            </p>
          </Section>

          <Section heading="4. What we don't do">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>No advertising, and no selling or renting your data. To anyone.</li>
              <li>No training AI models on your home record.</li>
              <li>No third-party trackers following you around the product.</li>
              <li>No holding your record hostage — export is never a paid feature.</li>
            </ul>
          </Section>

          <Section heading="Holding us to it">
            <p style={{ margin: 0 }}>
              The best audit is your own: download your archive from{' '}
              <Link href="/settings" style={{ color: 'var(--color-brass-deep)' }}>Settings</Link> today and open it.
              If anything is missing that should not be, tell us:{' '}
              <a href="mailto:support@ourhomefolder.com" style={{ color: 'var(--color-brass-deep)' }}>support@ourhomefolder.com</a>.
            </p>
          </Section>
        </Card>

        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            See also our <Link href="/privacy" style={{ color: 'var(--color-brass-deep)' }}>Privacy Policy</Link> and{' '}
            <Link href="/terms" style={{ color: 'var(--color-brass-deep)' }}>Terms of Service</Link>.
          </p>
        </Card>
      </div>
    </>
  );
}
