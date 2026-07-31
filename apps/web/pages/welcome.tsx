import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { UTILITY_TYPES } from '@home-folder/shared';
import { Button, Card, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getCurrentUser, isSupabaseConfigured } from '../lib/auth';
import { createPropertyForUser, getPrimaryPropertyForUser, type PropertySummary } from '../lib/properties';
import { createUtilityForContext, getUtilityDataContext } from '../lib/utilities';
import { PROPERTY_TYPES, formatEnumLabel } from '@home-folder/shared';

// First run.
//
// The obvious onboarding for a home-record app is "add all your rooms", and it
// is the wrong one: it is twenty minutes of data entry before anything useful
// comes back. This asks for two things instead — where the water shuts off and
// where the electrical panel is — because most people genuinely do not know,
// finding out takes five minutes, and the moment both are recorded the
// Emergency screen and the service call sheet start working.
//
// It is also what the product's own completeness score rewards most heavily
// (15 and 10 points), so the fast win and the valuable win are the same thing.

type Step = 'home' | 'water' | 'electrical' | 'done';

const STEP_ORDER: Step[] = ['home', 'water', 'electrical', 'done'];

export default function WelcomePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('home');
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [nickname, setNickname] = useState('');
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>('single_family_home');

  const [waterLocation, setWaterLocation] = useState('');
  const [electricalLocation, setElectricalLocation] = useState('');
  const [recorded, setRecorded] = useState<string[]>([]);

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (!isMounted) return;

        if (!user || !supabaseReady) {
          setChecking(false);
          return;
        }

        // Someone who already has a property is not a first run; skip ahead
        // rather than inviting them to create a second one.
        const existing = await getPrimaryPropertyForUser(user.id);
        if (!isMounted) return;

        if (existing) {
          setProperty(existing);
          setNickname(existing.nickname);
          setStep('water');
        }
      } catch {
        // A failed check should not block the flow; the save path re-verifies.
      } finally {
        if (isMounted) setChecking(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [supabaseReady]);

  async function handleCreateHome(event: React.FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setError('Give your home a name so you can recognise it later.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Please sign in again before continuing.');
      }

      const created = await createPropertyForUser(user, {
        nickname: nickname.trim(),
        property_type: propertyType
      });

      setProperty(created);
      setStep('water');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create your home.');
    } finally {
      setSaving(false);
    }
  }

  async function recordUtility(
    utilityType: (typeof UTILITY_TYPES)[number],
    name: string,
    location: string,
    nextStep: Step
  ) {
    setSaving(true);
    setError('');

    try {
      const context = await getUtilityDataContext();
      await createUtilityForContext(context, {
        utility_type: utilityType,
        name,
        room_id: null,
        location_notes: location.trim() || null,
        emergency_notes: null
      });

      setRecorded((current) => [...current, name]);
      setStep(nextStep);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save that yet.');
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  if (checking) {
    return (
      <>
        <PageHeader title="Welcome" />
        <Card>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Getting things ready...</p>
        </Card>
      </>
    );
  }

  if (!supabaseReady) {
    return (
      <>
        <PageHeader title="Welcome" description="Set up your home record." />
        <Card>
          <p style={{ marginTop: 0 }}>
            Account saving is not available in this local build, so there is nothing to set up yet.
            You can still try everything in demo mode.
          </p>
          <ActionLink href="/dashboard">Go to the dashboard</ActionLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="First run"
        title="Let's start with the two things nobody can find"
        description="Most people don't know where their water shuts off until water is coming through the ceiling. Five minutes now, and it's written down for good."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STEP_ORDER.slice(0, 3).map((entry, index) => (
            <UtilityBadge
              key={entry}
              label={
                entry === 'home' ? '1 · Your home' : entry === 'water' ? '2 · Water shut-off' : '3 · Electrical panel'
              }
              tone={index < stepIndex ? 'good' : 'neutral'}
            />
          ))}
        </div>

        {error ? (
          <Card>
            <p style={{ margin: 0, color: 'var(--status-urgent)', fontWeight: 700 }} role="alert">
              {error}
            </p>
          </Card>
        ) : null}

        {step === 'home' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>What should we call this home?</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Just a name you'll recognise. You can add the address later in Settings — it stays
              private unless you choose to put it on a document for a technician.
            </p>
            <form onSubmit={handleCreateHome} style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Name</span>
                <Input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Example: Our house"
                  autoFocus
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Type</span>
                <Select
                  value={propertyType}
                  onChange={(event) =>
                    setPropertyType(event.target.value as (typeof PROPERTY_TYPES)[number])
                  }
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
                    </option>
                  ))}
                </Select>
              </label>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Continue'}
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {step === 'water' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Where does the water shut off?</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              The main valve for the whole house. Often in a basement, a utility cupboard, under
              the kitchen sink, or in a box near the street. Go and look if you're not sure —
              that's the point of this.
            </p>
            <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Where it is</span>
                <Input
                  value={waterLocation}
                  onChange={(event) => setWaterLocation(event.target.value)}
                  placeholder="Example: basement, back wall behind the boiler"
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  disabled={saving || !waterLocation.trim()}
                  onClick={() =>
                    recordUtility('main_water_shutoff', 'Main water shut-off', waterLocation, 'electrical')
                  }
                >
                  {saving ? 'Saving...' : 'Save and continue'}
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => setStep('electrical')}>
                  I'll find it later
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 'electrical' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Where's the electrical panel?</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              The breaker box. Worth noting which room it's in and anything that makes it hard to
              find — behind a door, inside a cupboard, up in the garage.
            </p>
            <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Where it is</span>
                <Input
                  value={electricalLocation}
                  onChange={(event) => setElectricalLocation(event.target.value)}
                  placeholder="Example: garage, left of the door"
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  disabled={saving || !electricalLocation.trim()}
                  onClick={() =>
                    recordUtility('electrical_panel', 'Electrical panel', electricalLocation, 'done')
                  }
                >
                  {saving ? 'Saving...' : 'Save and finish'}
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => setStep('done')}>
                  I'll find it later
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 'done' ? (
          <>
            <Card tone="dark">
              <h2 style={{ marginTop: 0 }}>
                {recorded.length > 0
                  ? 'That already puts you ahead of most households'
                  : "Your home record is started"}
              </h2>
              {recorded.length > 0 ? (
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>
                  You've recorded {recorded.join(' and ')}. Anyone in the house can now find
                  {recorded.length > 1 ? ' them' : ' it'} in an emergency, and both appear
                  automatically on the sheet you hand a repair technician.
                </p>
              ) : (
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>
                  Nothing recorded yet — no problem. The two shut-offs are the best place to start
                  whenever you have five minutes.
                </p>
              )}
              <ActionLink href="/dashboard">Go to your dashboard</ActionLink>
            </Card>

            <Card>
              <h2 style={{ marginTop: 0 }}>Good next steps</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
                None of this has to happen today. The record is worth more each time you add to it.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <strong>Walk one room with your phone.</strong>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Record the big-ticket items — appliances, electronics, furniture. Ten minutes
                    now is worth everything after a fire, flood or theft.
                  </p>
                </div>
                <div>
                  <strong>Add the rooms you actually use.</strong>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    You don't need every cupboard. Rooms are just somewhere to file things.
                  </p>
                </div>
                <div>
                  <strong>Note the next thing that needs doing.</strong>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    A filter, a service, a leak you're watching. That's what turns this into a
                    record rather than a list.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                <ActionLink href="/inventory" variant="secondary">Start an inventory</ActionLink>
                <ActionLink href="/add-rooms" variant="secondary">Add rooms</ActionLink>
                <ActionLink href="/utilities" variant="secondary">Add another utility</ActionLink>
              </div>
            </Card>
          </>
        ) : null}

        {step !== 'done' ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-muted)',
                textDecoration: 'underline',
                cursor: 'pointer',
                font: 'inherit'
              }}
            >
              Skip setup and go to the dashboard
            </button>
          </p>
        ) : null}
      </div>
    </>
  );
}
