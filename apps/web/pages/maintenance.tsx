import { useEffect, useState } from 'react';
import { Button, Card, PageHeader } from '@home-folder/ui';
import { ActionLink } from '../components/ActionLink';
import { ShortcutLink } from '../components/ShortcutLink';
import { usePropertyAccess } from '../lib/access';
import { getAssetDataContext, getAssetsForProperty, getDemoAssets } from '../lib/assets';
import { getDemoRooms } from '../lib/demoStorage';
import { getPropertyAddressDetails } from '../lib/properties';
import { createReminderForContext, getReminderDataContext } from '../lib/reminders';
import { getRoomsForProperty } from '../lib/rooms';
import { buildSeasonalPlan, type SeasonalMonth, type SeasonalTask } from '../lib/seasonalPlan';
import { getDemoUtilities, getUtilitiesForProperty } from '../lib/utilities';

const maintenanceLinks = [
  {
    title: 'Warranties',
    description: 'See what is covered, what is ending soon, and where the proof lives.',
    href: '/warranties',
    action: 'Open warranties'
  },
  {
    title: 'Receipts',
    description: 'Keep purchase and service receipts close to the things they support.',
    href: '/receipts',
    action: 'Open receipts'
  },
  {
    title: 'Reminders',
    description: 'Remember filters, seasonal work, inspections, and tune-ups before they drift.',
    href: '/reminders',
    action: 'Open reminders'
  },
  {
    title: 'Repairs & Service History',
    description: 'Track open work, contractors, and completion notes alongside past tune-ups and visits — plus print or text a service call sheet to a repair pro.',
    href: '/repairs',
    action: 'Open repairs & service history'
  },
  {
    title: 'Issues',
    description: 'Watch recurring problems, severity, status, and patterns over time.',
    href: '/issues',
    action: 'Open issues'
  },
  {
    title: 'Trends',
    description: 'Review patterns that may need attention before they become bigger problems.',
    href: '/issues#trends',
    action: 'View trends'
  }
];

const maintenanceShortcuts = [
  { label: 'Warranties', href: '/warranties' },
  { label: 'Receipts', href: '/receipts' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Repairs & Service History', href: '/repairs' },
  { label: 'Issues', href: '/issues' },
  { label: 'Trends', href: '/issues#trends' }
];

const YARD_ROOM_TYPES = new Set(['yard', 'exterior', 'patio', 'deck', 'shed']);
const BASEMENT_ROOM_TYPES = new Set(['basement', 'crawl_space']);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// A sensible due date inside the target month: mid-month, or today when the
// 15th has already passed (current month only — never a date in the past).
function dueDateForMonth(month: number): string {
  const now = new Date();
  const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
  const mid = new Date(year, month - 1, 15);
  const due = mid < now ? now : mid;
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

function SeasonalTaskRow({ task, month, canWrite }: { task: SeasonalTask; month: number; canWrite: boolean }) {
  const [state, setState] = useState<'idle' | 'saving' | 'added' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const addAsReminder = async () => {
    setState('saving');
    setMessage('');

    try {
      const reminderContext = await getReminderDataContext();
      await createReminderForContext(reminderContext, {
        title: task.title,
        description: `${task.why} (From your seasonal plan.)`,
        reminder_type: 'seasonal',
        source: 'system_suggestion',
        due_date: dueDateForMonth(month),
        priority: 'normal'
      });
      setState('added');
    } catch (reminderError) {
      setState('error');
      setMessage(reminderError instanceof Error ? reminderError.message : 'Could not add the reminder.');
    }
  };

  return (
    <li style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220, flex: '1 1 260px' }}>
          <strong>{task.title}</strong>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{task.why}</p>
        </div>
        {state === 'added' ? (
          <span style={{ color: 'var(--status-good)', fontSize: '0.875rem' }}>Reminder added</span>
        ) : canWrite ? (
          <Button type="button" variant="secondary" disabled={state === 'saving'} onClick={addAsReminder}>
            {state === 'saving' ? 'Adding…' : 'Add as reminder'}
          </Button>
        ) : null}
      </div>
      {state === 'error' && message ? (
        <p style={{ margin: '4px 0 0', color: 'var(--status-urgent)', fontSize: '0.875rem' }}>{message}</p>
      ) : null}
    </li>
  );
}

export default function MaintenanceHubPage() {
  const access = usePropertyAccess();
  const [plan, setPlan] = useState<SeasonalMonth[] | null>(null);
  const [planIsDemo, setPlanIsDemo] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Deterministic and $0: the plan is computed locally from the home profile
    // (climate band, yard, basement, utilities, assets). No AI, no network
    // beyond the reads the rest of the app already makes.
    async function loadPlan() {
      try {
        const context = await getAssetDataContext();

        let state: string | null = null;
        let rooms: Array<{ room_type: string }> = [];
        let utilityTypes: string[] = [];
        let assetTypes: string[] = [];

        if (context.mode === 'supabase' && context.property) {
          const [addressDetails, roomRows, utilities, assets] = await Promise.all([
            getPropertyAddressDetails(context.property.id).catch(() => null),
            getRoomsForProperty(context.property.id).catch(() => []),
            getUtilitiesForProperty(context.property.id).catch(() => []),
            getAssetsForProperty(context.property.id).catch(() => [])
          ]);
          state = addressDetails?.state ?? null;
          rooms = roomRows;
          utilityTypes = utilities.map((utility) => utility.utility_type);
          assetTypes = assets.map((asset) => asset.asset_type);
        } else {
          rooms = getDemoRooms();
          utilityTypes = getDemoUtilities().map((utility) => utility.utility_type);
          assetTypes = getDemoAssets().map((asset) => asset.asset_type);
        }

        if (!isMounted) {
          return;
        }

        setPlanIsDemo(context.mode === 'demo');
        setPlan(
          buildSeasonalPlan({
            state,
            hasYard: rooms.some((room) => YARD_ROOM_TYPES.has(room.room_type)),
            hasBasement: rooms.some((room) => BASEMENT_ROOM_TYPES.has(room.room_type)),
            utilityTypes,
            assetTypes
          })
        );
      } catch {
        if (isMounted) {
          // Fall back to the generic plan rather than showing nothing.
          setPlan(buildSeasonalPlan({ state: null, hasYard: false, hasBasement: false, utilityTypes: [], assetTypes: [] }));
        }
      }
    }

    loadPlan();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentMonth = new Date().getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const currentTasks = plan?.find((entry) => entry.month === currentMonth)?.tasks ?? [];
  const nextTasks = plan?.find((entry) => entry.month === nextMonth)?.tasks ?? [];

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Care, records, and the things that need attention."
      />

      <div style={{ display: 'grid', gap: 24 }}>
        <Card tone="dark">
          <h2 style={{ marginTop: 0 }}>Care, records, and risk tracking</h2>
          <p style={{ color: 'rgba(255,248,234,0.78)' }}>
            Use Maintenance for what needs attention, what has been serviced, what is under warranty, and what risks are emerging.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {maintenanceShortcuts.map((shortcut) => (
              <ShortcutLink
                key={shortcut.label}
                href={shortcut.href}
                label={shortcut.label}
                variant="brassOnDark"
              />
            ))}
          </div>
        </Card>

        <Card>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Seasonal plan</h2>
          <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
            Built from your home profile — climate, yard, basement, and the systems you have on record.
            No AI, no cost: the same profile always produces the same plan.
            {planIsDemo ? ' Demo mode: reminders you add stay only in this browser.' : ''}
          </p>

          {plan === null ? (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Building your plan…</p>
          ) : (
            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>{MONTH_NAMES[currentMonth - 1]} — this month</h3>
                {currentTasks.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing on the plan this month.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {currentTasks.map((task) => (
                      <SeasonalTaskRow key={task.title} task={task} month={currentMonth} canWrite={access.loading || access.canWrite} />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>{MONTH_NAMES[nextMonth - 1]} — coming up</h3>
                {nextTasks.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing on the plan next month.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {nextTasks.map((task) => (
                      <SeasonalTaskRow key={task.title} task={task} month={nextMonth} canWrite={access.loading || access.canWrite} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {maintenanceLinks.map((link) => (
            <Card key={`${link.title}-${link.href}`} style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ marginTop: 0 }}>{link.title}</h2>
              <p style={{ color: 'var(--text-muted)' }}>{link.description}</p>
              {/* Pinned to the card's bottom edge so every action in the row aligns. */}
              <div style={{ marginTop: 'auto' }}>
                <ActionLink href={link.href} variant={link.title === 'Reminders' ? 'primary' : 'secondary'}>
                  {link.action}
                </ActionLink>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
