import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, PageHeader, UtilityBadge } from '@home-bible/ui';
import { getCurrentUser } from '../lib/auth';

const routeGroups = [
  {
    title: 'Start and account',
    routes: [
      ['Home', '/'],
      ['Sign up', '/sign-up'],
      ['Sign in', '/sign-in'],
      ['Settings', '/settings']
    ]
  },
  {
    title: 'Core home data',
    routes: [
      ['Dashboard', '/dashboard'],
      ['Create property', '/create-property'],
      ['Add rooms', '/add-rooms'],
      ['Home map', '/home-map'],
      ['Utilities', '/utilities'],
      ['Assets', '/assets'],
      ['Warranties', '/warranties'],
      ['Reminders', '/reminders']
    ]
  },
  {
    title: 'Records and review',
    routes: [
      ['Repairs', '/repairs'],
      ['Issues', '/issues'],
      ['Documents', '/documents'],
      ['Receipts', '/receipts'],
      ['Home Handover', '/handover'],
      ['Sharing review', '/sharing']
    ]
  }
] as const;

const walkthroughSteps = [
  'Create or sign into a private test account.',
  'Create Maple House with address skipped.',
  'Add rooms, utilities, assets, reminders, repairs, service history, issues, and trends manually.',
  'Upload a few small placeholder documents and receipts.',
  'Approve receipt details before saving receipt rows.',
  'Generate Family and Buyer handover reports in the browser.',
  'Review viewer, maintenance_guest, and buyer_preview sharing previews.',
  'Repeat the main navigation and forms on a mobile viewport.',
  'Log every blocker with route, steps, expected result, actual result, mode, and severity.'
];

const safetyChecks = [
  'Do not enter secrets, security credentials, private entry details, or sensitive household instructions.',
  'Do not create seed data automatically.',
  'Do not upload large or unnecessary files.',
  'Delete unneeded test uploads when the test is done.',
  'Confirm documents use private signed access only.',
  'Confirm sharing remains preview-only.',
  'Confirm no report file, invitation, public link, or background job is created.'
];

export default function MvpTestPage() {
  const [modeLabel, setModeLabel] = useState('Checking mode...');

  useEffect(() => {
    let isMounted = true;

    async function loadMode() {
      const user = await getCurrentUser();
      if (!isMounted) return;

      if (user) {
        setModeLabel(`Saved to your account: ${user.email || 'authenticated user'}`);
        return;
      }

      setModeLabel('Demo data is stored only in this browser.');
    }

    loadMode();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Private MVP Test"
        description="Manual test checklist for validating Home Bible with realistic homeowner data before adding more features."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <UtilityBadge label={modeLabel} />
            <UtilityBadge label="Private testing only" />
            <UtilityBadge label="Manual seed only" />
          </div>
          <p style={{ color: '#6b7280', marginTop: 0 }}>
            This page does not create background jobs, send data externally, or enable paid services.
          </p>
          <p style={{ color: '#6b7280', marginBottom: 0 }}>
            Use it as a guide while following the MVP test docs. Sample data must be entered manually and should avoid secrets or sensitive access instructions.
          </p>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0 }}>Manual seed walkthrough</h2>
          <p style={{ color: '#6b7280' }}>
            Build the Maple House sample by hand. Keep files small, use placeholders when possible, and do not upload anything that should not be used in testing.
          </p>
          <ol style={{ lineHeight: 1.7, paddingLeft: 22 }}>
            {walkthroughSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {routeGroups.map((group) => (
            <Card key={group.title}>
              <h2 style={{ marginTop: 0 }}>{group.title}</h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {group.routes.map(([label, href]) => (
                  <Link key={href} href={href}>
                    <Button type="button">{label}</Button>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Card>
            <h2 style={{ marginTop: 0 }}>Pass signals</h2>
            <ul style={{ color: '#4b5563', lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Tester can complete onboarding without coaching.</li>
              <li>Core records can be created, viewed, edited, and linked safely.</li>
              <li>Documents and receipts feel private and controlled.</li>
              <li>Receipt details are saved only after approval.</li>
              <li>Handover and sharing previews are useful and conservative.</li>
              <li>Mobile navigation remains usable.</li>
            </ul>
          </Card>

          <Card>
            <h2 style={{ marginTop: 0 }}>Safety checks</h2>
            <ul style={{ color: '#4b5563', lineHeight: 1.7, paddingLeft: 20 }}>
              {safetyChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <h2 style={{ marginTop: 0 }}>Bug report reminder</h2>
          <p style={{ color: '#6b7280' }}>
            Capture route, steps to reproduce, expected result, actual result, browser/device, signed-in versus demo mode, data involved, severity, and whether there is a security or cost concern.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/dashboard">
              <Button type="button">Start from dashboard</Button>
            </Link>
            <Link href="/settings">
              <Button type="button">Open settings</Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
