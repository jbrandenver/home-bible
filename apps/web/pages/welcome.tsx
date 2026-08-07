import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { UTILITY_TYPES } from '@home-folder/shared';
import { Button, Card, ConfirmDialog, Input, PageHeader, Select, UtilityBadge } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { getCurrentUser, getCurrentUserUncached, isSupabaseConfigured } from '../lib/auth';
import { setDemoActiveProperty } from '../lib/demoStorage';
import {
  clearDemoData,
  createPropertyFromDemoHome,
  importDemoDataIntoAccount,
  summarizeDemoData,
  type DemoSummary
} from '../lib/demoImport';
import { getAssetDataContext } from '../lib/assets';
import { getIssueDataContext } from '../lib/issues';
import { getReminderDataContext } from '../lib/reminders';
import { getRepairDataContext } from '../lib/repairs';
import { getServiceRecordDataContext } from '../lib/serviceRecords';
import {
  createPropertyForUser,
  getPrimaryPropertyForUser,
  updatePropertyStructure,
  type PropertySummary
} from '../lib/properties';
import { createUtilityForContext, getUtilityDataContext } from '../lib/utilities';
import { PROPERTY_TYPES, formatEnumLabel } from '@home-folder/shared';
import { SpaceGrid } from '../components/SpaceGrid';
import { CheckList } from '../components/CheckList';
import { createRoomsForContext, getRoomDataContext } from '../lib/roomsContext';
import { getRoomsForProperty } from '../lib/rooms';
import { deriveHasFlags } from '../lib/propertyFlags';
import { US_STATES, buildSeasonalPlan } from '../lib/seasonalPlan';
import { selectSeedReminders } from '../lib/seasonalSeed';
import { createReminderForContext, getRemindersForContext } from '../lib/reminders';
import {
  MAX_FLOOR_COUNT,
  MIN_FLOOR_COUNT,
  clampFloorCount,
  expandRoomSelection
} from '../lib/starterRooms';
import {
  DEDICATED_UTILITY_TYPES,
  defaultSelectionFor,
  getStarterTemplate,
  offeredSpacesFor,
  offeredUtilitiesFor,
  utilityNameForType,
  type SpaceSelection
} from '../lib/starterTemplates';

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

// 'demo' comes first: somebody who mapped their house before signing up must
// be asked what to do with that work before being handed a blank wizard that
// silently ignores it.
type Step = 'demo' | 'home' | 'spaces' | 'water' | 'electrical' | 'systems' | 'done';

const STEP_ORDER: Step[] = ['home', 'spaces', 'water', 'electrical', 'systems', 'done'];

const STEP_LABELS: Partial<Record<Step, string>> = {
  home: '1 · Your home',
  spaces: '2 · Rooms & spaces',
  water: '3 · Water shut-off',
  electrical: '4 · Electrical panel',
  systems: '5 · Systems'
};

/** The systems grid's starting state for a kind of home and its ticked spaces. */
function selectionForUtilities(
  propertyType: (typeof PROPERTY_TYPES)[number],
  spaces: SpaceSelection
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const utility of offeredUtilitiesFor(propertyType, spaces)) {
    next[utility.utility_type] = utility.checked;
  }
  return next;
}

export default function WelcomePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('home');
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [demoSummary, setDemoSummary] = useState<DemoSummary | null>(null);
  const [confirmingDemoDiscard, setConfirmingDemoDiscard] = useState(false);
  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [nickname, setNickname] = useState('');
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>('single_family_home');

  const [waterLocation, setWaterLocation] = useState('');
  const [electricalLocation, setElectricalLocation] = useState('');
  const [recorded, setRecorded] = useState<string[]>([]);
  // Kept separately from the display names above because the seasonal plan
  // keys off utility_type, not off what the row is called.
  const [recordedUtilityTypes, setRecordedUtilityTypes] = useState<string[]>([]);

  // The state is asked for one reason only, and the label says so: it picks the
  // climate band that times the seasonal care plan. Nothing else reads it.
  const [stateCode, setStateCode] = useState('');
  const [spaceSelection, setSpaceSelection] = useState<SpaceSelection>(() =>
    defaultSelectionFor('single_family_home')
  );
  const [floorCount, setFloorCount] = useState(
    () => getStarterTemplate('single_family_home').defaultFloorCount
  );
  const [roomsCreated, setRoomsCreated] = useState(0);
  const [systemsCreated, setSystemsCreated] = useState(0);
  const [seededReminders, setSeededReminders] = useState<string[]>([]);
  const [utilitySelection, setUtilitySelection] = useState<Record<string, boolean>>(() =>
    selectionForUtilities('single_family_home', defaultSelectionFor('single_family_home'))
  );

  const offeredSpaces = offeredSpacesFor(propertyType);
  const insideSpaces = offeredSpaces.filter((space) => space.zone === 'inside');
  const outsideSpaces = offeredSpaces.filter((space) => space.zone === 'outside');
  const plannedRooms = expandRoomSelection(propertyType, spaceSelection, floorCount);

  // The water and electrical steps own their two types — they capture a
  // location, which is the reason for asking at all.
  const offeredSystems = offeredUtilitiesFor(propertyType, spaceSelection).filter(
    (utility) => !DEDICATED_UTILITY_TYPES.includes(utility.utility_type)
  );
  const checkedSystems = offeredSystems.filter(
    (utility) => utilitySelection[utility.utility_type]
  );

  function handlePropertyTypeChange(nextType: (typeof PROPERTY_TYPES)[number]) {
    setPropertyType(nextType);
    // A condo has no crawl space and a building has no bedrooms, so the grids
    // are rebuilt rather than carried across. This runs before either is ever
    // shown, so nothing a person ticked can be lost here.
    const nextSpaces = defaultSelectionFor(nextType);
    setSpaceSelection(nextSpaces);
    setFloorCount(getStarterTemplate(nextType).defaultFloorCount);
    setUtilitySelection(selectionForUtilities(nextType, nextSpaces));
  }

  function handleSpaceChange(key: string, count: number) {
    setSpaceSelection((current) => {
      const next = { ...current, [key]: count };
      // Ticking a basement makes a sump pump worth offering; un-ticking it
      // takes the offer away again. Anything already decided is preserved.
      setUtilitySelection((currentUtilities) => {
        const rebuilt = selectionForUtilities(propertyType, next);
        for (const key of Object.keys(rebuilt)) {
          if (key in currentUtilities) {
            rebuilt[key] = currentUtilities[key];
          }
        }
        return rebuilt;
      });
      return next;
    });
  }

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

        const demo = summarizeDemoData();
        if (demo.hasAnything) {
          setDemoSummary(demo);
        }

        if (existing) {
          setProperty(existing);
          setNickname(existing.nickname);

          // Match the grid to the home they already recorded, so someone who
          // comes back to map rooms is not offered a house's set for a condo.
          const knownType = PROPERTY_TYPES.find((type) => type === existing.property_type);
          if (knownType) {
            setPropertyType(knownType);
            const spaces = defaultSelectionFor(knownType);
            setSpaceSelection(spaces);
            setFloorCount(getStarterTemplate(knownType).defaultFloorCount);
            setUtilitySelection(selectionForUtilities(knownType, spaces));
          }
        }

        // The browser copy is the thing they already spent time on, so it is
        // the first question — ahead of naming a home they may have named.
        if (demo.hasAnything) {
          setStep('demo');
        } else if (existing) {
          // A property with no rooms is someone the dashboard sent here to map
          // them. Dropping them on the water step instead would be a dead end.
          const existingRooms = await getRoomsForProperty(existing.id);
          if (!isMounted) return;
          setStep(existingRooms.length === 0 ? 'spaces' : 'water');
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

  async function handleDemoImport() {
    setSaving(true);
    setError('');

    try {
      const user = await getCurrentUserUncached();
      if (!user) {
        throw new Error('Sign in again to bring this home into your account.');
      }

      // Reuse the account's property if it already has one; otherwise create it
      // from the demo home, which already carries the name they chose.
      const targetPropertyId = property?.id ?? (await createPropertyFromDemoHome(user));

      const [utility, asset, reminder, repair, serviceRecord, issue] = await Promise.all([
        getUtilityDataContext(),
        getAssetDataContext(),
        getReminderDataContext(),
        getRepairDataContext(),
        getServiceRecordDataContext(),
        getIssueDataContext()
      ]);

      const result = await importDemoDataIntoAccount(targetPropertyId, {
        utility,
        asset,
        reminder,
        repair,
        serviceRecord,
        issue
      });

      // Keep the browser copy if anything failed, so nothing is destroyed that
      // did not make it across.
      if (Object.keys(result.failed).length === 0) {
        clearDemoData();
      }

      router.push('/dashboard');
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Could not bring your home across. Nothing was removed from this browser.'
      );
      setSaving(false);
    }
  }

  // In-page confirmation rather than window.confirm, which a browser may
  // suppress — it then returns false and the discard silently does nothing.
  function handleDemoDiscard() {
    clearDemoData();
    setConfirmingDemoDiscard(false);
    setDemoSummary(null);
    setStep(property ? 'water' : 'home');
  }

  async function handleCreateHome(event: React.FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setError('Give your home a name so you can recognise it later.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Confirm signed-out state without the cache before writing anywhere.
      // getCurrentUser answers from a 5-second cache that can still hold the
      // `null` from a moment earlier during a sign-out -> sign-in switch, and
      // this branch decides whether the person's home is saved to their
      // account or only to this browser. Getting that wrong loses their work.
      const user = (await getCurrentUser()) ?? (await getCurrentUserUncached());
      if (!user) {
        // A signed-out visitor arriving from the landing page's "try it in
        // this browser" promise: keep that promise. Record the home in
        // browser-local demo storage — the same fallback create-property
        // uses — and the utility steps below follow suit automatically,
        // because getUtilityDataContext resolves to demo mode when signed
        // out. Signing up later offers to import everything.
        setDemoActiveProperty({
          id: crypto.randomUUID(),
          nickname: nickname.trim(),
          property_type: propertyType,
          created_at: new Date().toISOString(),
          state: stateCode || undefined
        });
        setStep('spaces');
        return;
      }

      const created = await createPropertyForUser(user, {
        nickname: nickname.trim(),
        property_type: propertyType,
        // Written here rather than through updatePropertyAddress, which
        // rewrites every address column and can flip address_is_enabled.
        state: stateCode || null
      });

      setProperty(created);
      setStep('spaces');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create your home.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * The whole starter set in one submit.
   *
   * Rooms first, then the property columns they imply — in that order, so the
   * flags can never claim a basement that failed to save.
   */
  async function handleCreateSpaces() {
    setSaving(true);
    setError('');

    try {
      const drafts = expandRoomSelection(propertyType, spaceSelection, floorCount);

      if (drafts.length === 0) {
        setStep('water');
        return;
      }

      // resolveDataContext confirms against the auth client before concluding
      // "signed out", so a stale cached null cannot send these to localStorage.
      const context = await getRoomDataContext();
      await createRoomsForContext(context, drafts);

      if (context.mode === 'supabase' && context.property) {
        const flags = deriveHasFlags(drafts);
        // Never fail the step over this: the rooms are the record, and these
        // columns are only derived from them.
        try {
          await updatePropertyStructure(context.property.id, {
            floor_count: clampFloorCount(floorCount),
            ...flags
          });
        } catch {
          /* the rooms landed; the derived columns can be rebuilt any time */
        }
      }

      setRoomsCreated(drafts.length);
      setStep('water');
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save those rooms yet.'
      );
    } finally {
      setSaving(false);
    }
  }

  /**
   * Create the ticked systems, then seed the care plan and finish.
   *
   * The seed runs whether or not any system was ticked, because the plan is
   * driven mostly by climate and by the rooms already recorded — a person who
   * skips this step should still land on a dashboard with something on it.
   */
  async function finishSetup(createSystems: boolean) {
    setSaving(true);
    setError('');

    const createdTypes: string[] = [];

    try {
      if (createSystems && checkedSystems.length > 0) {
        const context = await getUtilityDataContext();

        for (const utility of checkedSystems) {
          try {
            await createUtilityForContext(context, {
              utility_type: utility.utility_type,
              // Derived from the type — welcome's own water and electrical
              // steps already do exactly this, and add-utility asking a person
              // to type what the type already says is the thing being removed.
              name: utilityNameForType(utility.utility_type),
              room_id: null,
              location_notes: null,
              emergency_notes: null
            });
            createdTypes.push(utility.utility_type);
          } catch {
            // One system failing must not cost the others, or the care plan.
          }
        }

        setSystemsCreated(createdTypes.length);
      }

      await seedSeasonalCare(createdTypes);
    } catch (finishError) {
      setError(
        finishError instanceof Error ? finishError.message : 'Could not finish setting up.'
      );
    } finally {
      setSaving(false);
      setStep('done');
    }
  }

  /**
   * Put the first two pieces of care on the calendar.
   *
   * This is the payoff arriving before the price: the reason people keep a
   * home record is that it tells them what needs doing, and that should not
   * wait until they have entered ten appliances. Two, not twelve months of
   * them — a wall of chores on day one reads as nagging.
   */
  async function seedSeasonalCare(extraUtilityTypes: string[]) {
    try {
      const context = await getReminderDataContext();

      // Match against what is actually stored, not component state: a second
      // tab or a re-run of the wizard must not write a duplicate. Same rule
      // the /maintenance page applies.
      const existing = await getRemindersForContext(context);
      const existingTitles = existing
        .filter((reminder) => reminder.status !== 'completed' && reminder.status !== 'dismissed')
        .map((reminder) => reminder.title);

      const plan = buildSeasonalPlan({
        state: stateCode || null,
        hasYard: (spaceSelection.yard ?? 0) > 0,
        hasBasement: (spaceSelection.basement ?? 0) > 0,
        utilityTypes: [...recordedUtilityTypes, ...extraUtilityTypes],
        assetTypes: []
      });

      const seeds = selectSeedReminders(plan, new Date(), existingTitles);

      for (const seed of seeds) {
        await createReminderForContext(context, {
          title: seed.title,
          description: seed.description,
          reminder_type: 'seasonal',
          source: 'system_suggestion',
          due_date: seed.due_date,
          priority: 'normal'
        });
      }

      setSeededReminders(seeds.map((seed) => seed.title));
    } catch {
      // A missing care plan is a smaller loss than a failed setup. The
      // /maintenance page shows the same plan and can add any of it in a tap.
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
      setRecordedUtilityTypes((current) => [...current, utilityType]);
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
      >
        {/* A transfer recipient does not set up a new home — the record they
            were handed already exists. Without this path, launch QA showed
            them funneled into new-home setup with nowhere to enter a code. */}
        <ActionLink href="/claim" variant="secondary">
          Been handed a home? Claim it with your transfer code
        </ActionLink>
      </PageHeader>

      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STEP_ORDER.slice(0, 5).map((entry, index) => (
            <UtilityBadge
              key={entry}
              label={STEP_LABELS[entry] ?? entry}
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

        {step === 'demo' && demoSummary ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>
              We found {demoSummary.propertyNickname ? demoSummary.propertyNickname : 'a home'} in this browser
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              You recorded {Object.entries(demoSummary.counts)
                .filter(([, count]) => count > 0)
                .map(([label, count]) => `${count} ${label}`)
                .join(', ')} before signing up. Bring it into your account and it is saved for good —
              you will not have to enter any of it again.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button onClick={handleDemoImport} disabled={saving}>
                {saving ? 'Bringing it across...' : 'Yes, bring it into my account'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingDemoDiscard(true)} disabled={saving}>
                Start fresh instead
              </Button>
            </div>
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
                    handlePropertyTypeChange(event.target.value as (typeof PROPERTY_TYPES)[number])
                  }
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEnumLabel(type)}
                    </option>
                  ))}
                </Select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>State</span>
                <Select value={stateCode} onChange={(event) => setStateCode(event.target.value)}>
                  <option value="">Prefer not to say</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </Select>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Used to time seasonal maintenance — when to think about gutters, or draining an
                  outside tap. Nothing else reads it, and it never leaves your record.
                </span>
              </label>
              <div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Continue'}
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {step === 'spaces' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>Tick what this home has</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              We have guessed from the kind of home you chose. Correct anything that is wrong and
              we will write the rooms for you — there is nothing to type. You can add, rename or
              remove any of them later.
            </p>

            <div style={{ display: 'grid', gap: 20, maxWidth: 620 }}>
              <label style={{ display: 'grid', gap: 6, maxWidth: 280 }}>
                <span style={{ fontWeight: 700 }}>Floors above ground</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MIN_FLOOR_COUNT}
                  max={MAX_FLOOR_COUNT}
                  step={1}
                  value={floorCount}
                  onChange={(event) => setFloorCount(clampFloorCount(Number(event.target.value)))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Not counting the basement. This is the only thing we ask about floors — each
                  room is put somewhere sensible, and you can move any of them afterwards.
                </span>
              </label>

              <SpaceGrid
                legend="Inside"
                spaces={insideSpaces}
                selection={spaceSelection}
                idPrefix="space-inside"
                disabled={saving}
                onChange={handleSpaceChange}
              />

              <SpaceGrid
                legend="Outside"
                spaces={outsideSpaces}
                selection={spaceSelection}
                idPrefix="space-outside"
                disabled={saving}
                onChange={handleSpaceChange}
              />

              {/* One announcement of the running total, rather than one per
                  keypress while somebody holds down "+". */}
              <p aria-live="polite" style={{ margin: 0, fontWeight: 700 }}>
                {plannedRooms.length === 0
                  ? 'No rooms selected.'
                  : `${plannedRooms.length} ${plannedRooms.length === 1 ? 'room' : 'rooms'} will be added.`}
              </p>

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                  See which floor each one goes on
                </summary>
                <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                  {plannedRooms.map((room) => (
                    <li key={`${room.floor_name}-${room.name}`}>
                      {room.name} — {room.floor_name}
                    </li>
                  ))}
                </ul>
              </details>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" disabled={saving} onClick={handleCreateSpaces}>
                  {saving
                    ? 'Writing the rooms...'
                    : plannedRooms.length === 0
                      ? 'Continue without rooms'
                      : `Add ${plannedRooms.length} ${plannedRooms.length === 1 ? 'room' : 'rooms'}`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setStep('water')}
                >
                  I'll do this later
                </Button>
              </div>
            </div>
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
                    recordUtility('electrical_panel', 'Electrical panel', electricalLocation, 'systems')
                  }
                >
                  {saving ? 'Saving...' : 'Save and continue'}
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => setStep('systems')}>
                  I'll find it later
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 'systems' ? (
          <Card>
            <h2 style={{ marginTop: 0 }}>And which of these does it have?</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              Just so they exist in the record — nothing to type, and no need to go and look at
              anything. Knowing a home has a furnace is what lets us tell you when it is worth
              servicing. You can add where each one lives, and its make and model, whenever you
              happen to be standing in front of it.
            </p>

            <div style={{ display: 'grid', gap: 20, maxWidth: 620 }}>
              <CheckList
                legend="Systems"
                items={offeredSystems.map((utility) => ({
                  key: utility.utility_type,
                  label: utilityNameForType(utility.utility_type)
                }))}
                checked={utilitySelection}
                idPrefix="system"
                disabled={saving}
                onToggle={(key, next) =>
                  setUtilitySelection((current) => ({ ...current, [key]: next }))
                }
              />

              <p aria-live="polite" style={{ margin: 0, fontWeight: 700 }}>
                {checkedSystems.length === 0
                  ? 'No systems selected.'
                  : `${checkedSystems.length} ${checkedSystems.length === 1 ? 'system' : 'systems'} will be added.`}
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" disabled={saving} onClick={() => finishSetup(true)}>
                  {saving
                    ? 'Finishing...'
                    : checkedSystems.length === 0
                      ? 'Finish'
                      : `Add ${checkedSystems.length} and finish`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => finishSetup(false)}
                >
                  I'll do this later
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
              {roomsCreated > 0 ? (
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>
                  {roomsCreated} {roomsCreated === 1 ? 'room is' : 'rooms are'} on the map
                  {systemsCreated > 0
                    ? `, along with ${systemsCreated} ${systemsCreated === 1 ? 'system' : 'systems'},`
                    : ''}{' '}
                  without your typing a word. Everything you record from here — an appliance, a
                  repair, a receipt — can be filed against one of them.
                </p>
              ) : null}

              {seededReminders.length > 0 ? (
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>
                  Your care calendar has started: {seededReminders.join(' and ')}
                  {seededReminders.length > 1 ? ' are' : ' is'} on it. The rest of the year is
                  already worked out from where you live — nothing is due until it is.
                </p>
              ) : null}
              {recorded.length > 0 ? (
                <p style={{ color: 'rgba(255,248,234,0.78)' }}>
                  You've recorded {recorded.join(' and ')}. Anyone in the house can now find
                  {recorded.length > 1 ? ' them' : ' it'} in an emergency, and both appear
                  automatically on the sheet you hand a repair technician.
                </p>
              ) : roomsCreated > 0 ? null : (
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
                <ActionLink href="/add-rooms" variant="secondary">Add rooms</ActionLink>
                <ActionLink href="/inventory" variant="secondary">Start an inventory</ActionLink>
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

      <ConfirmDialog
        open={confirmingDemoDiscard}
        title="Discard the home recorded in this browser and start fresh?"
        description="This cannot be undone."
        confirmLabel="Discard and start fresh"
        cancelLabel="Keep it"
        onConfirm={handleDemoDiscard}
        onCancel={() => setConfirmingDemoDiscard(false)}
      />
    </>
  );
}
