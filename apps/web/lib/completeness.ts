// What the record holds + "This Week at Home" digest.
//
// Pure client-side computation over data every page already loads — no queries,
// no background jobs, no cost.
//
// WHY THIS IS TWO BANDS AND NOT A PERCENTAGE
// DESIGN.md: "Status is a seal, never a streak." A single 0-100 number looked
// like a seal and behaved like a streak, for two reasons.
//
// First, it could not be finished. Serials, values and photos were ratios over
// an ever-growing asset count, so 100 receded as you used the product — and,
// worse, adding an eleventh appliance without a serial number LOWERED the
// score. The measure actively punished capture, which is the one behaviour the
// product wants.
//
// Second, someone who completed first-run setup perfectly saw 25/100 and a
// list of failures. That is completion pressure, which the product refuses.
//
// So: a finite set of essentials that can genuinely be completed — and is,
// by the end of the wizard — which earns a struck seal. Then the long tail,
// reported as plain counts with no denominator and nothing to chase.
//
// If someone proposes putting the percentage back, this is the argument.

import type { AssetRow } from './assets';
import type { DocumentRow } from './documents';
import type { ReminderRow } from './reminders';
import type { RepairRow } from './repairs';
import type { ServiceRecordRow } from './serviceRecords';
import type { UtilityRow } from './utilities';

/**
 * `essentials` are finite and completable; `deepening` is open-ended and must
 * never be shown with a denominator or a target to chase.
 */
export type CompletenessGroup = 'essentials' | 'deepening';

export type CompletenessCheck = {
  id: string;
  label: string;
  detail: string;
  group: CompletenessGroup;
  earned: number;
  possible: number;
  done: boolean;
  href: string;
};

export type CompletenessResult = {
  /**
   * Kept internal to this module's consumers for ordering only. Deliberately
   * not rendered as a percentage — see the header.
   */
  score: number;
  checks: CompletenessCheck[];
  essentials: CompletenessCheck[];
  deepening: CompletenessCheck[];
  /** Every essential recorded. This is what earns the seal. */
  sealed: boolean;
  /** Incomplete essentials first; the long tail never outranks them. */
  nextActions: CompletenessCheck[];
};

type CompletenessInput = {
  roomCount: number;
  utilities: UtilityRow[];
  assets: AssetRow[];
  documents: DocumentRow[];
  reminders: ReminderRow[];
};

/** A home has this many systems worth naming before the list is useful. */
const SYSTEMS_TARGET = 3;

/**
 * The point at which the long tail stops being scored.
 *
 * Fixed, never the current asset count. Dividing by "how many assets you have"
 * is what made recording an appliance without its serial number reduce the
 * score — so the more honest you were, the worse you looked.
 */
const INVENTORY_TARGET = 10;
const PAPERS_TARGET = 3;

function ratioPoints(numerator: number, target: number, possible: number) {
  if (target <= 0) return 0;
  return Math.min(possible, Math.round((Math.min(numerator, target) / target) * possible));
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const { roomCount, utilities, assets, documents, reminders } = input;

  const utilityTypes = new Set(utilities.map((utility) => utility.utility_type));
  const hasWaterShutoff = utilityTypes.has('main_water_shutoff');
  const hasElectricalPanel = utilityTypes.has('electrical_panel') || utilityTypes.has('breaker_panel');

  const assetsWithSerial = assets.filter((asset) => asset.serial_number).length;
  const assetsWithValue = assets.filter((asset) => asset.purchase_price !== null).length;
  const assetIdsWithPhotos = new Set(
    documents
      .filter((document) => document.asset_id && (document.thumbnail_path || document.mime_type?.startsWith('image/')))
      .map((document) => document.asset_id as string)
  );
  const openReminders = reminders.filter((reminder) => reminder.status === 'open').length;

  const systemsListed = utilities.length;

  // Five things, all reachable in first-run setup, all yes-or-no. This band
  // exists to be finished.
  const essentials: CompletenessCheck[] = [
    {
      id: 'rooms',
      label: 'Rooms mapped',
      detail: roomCount > 0 ? countLabel(roomCount, 'room') : 'Tick what this home has',
      group: 'essentials',
      earned: roomCount > 0 ? 20 : 0,
      possible: 20,
      done: roomCount > 0,
      href: '/welcome'
    },
    {
      id: 'water',
      label: 'Water shut-off recorded',
      detail: hasWaterShutoff
        ? 'On file'
        : 'The one record that matters in a burst-pipe emergency',
      group: 'essentials',
      earned: hasWaterShutoff ? 20 : 0,
      possible: 20,
      done: hasWaterShutoff,
      href: '/add-utility'
    },
    {
      id: 'electrical',
      label: 'Electrical panel recorded',
      detail: hasElectricalPanel ? 'On file' : 'Record where the breaker panel lives',
      group: 'essentials',
      earned: hasElectricalPanel ? 20 : 0,
      possible: 20,
      done: hasElectricalPanel,
      href: '/add-utility'
    },
    {
      id: 'systems',
      label: 'Systems listed',
      detail:
        systemsListed >= SYSTEMS_TARGET
          ? countLabel(systemsListed, 'system')
          : 'Name the boiler, the water heater, the alarms',
      group: 'essentials',
      earned: systemsListed >= SYSTEMS_TARGET ? 20 : 0,
      possible: 20,
      done: systemsListed >= SYSTEMS_TARGET,
      href: '/utilities'
    },
    {
      id: 'care',
      label: 'Care planned',
      detail:
        openReminders > 0
          ? `${countLabel(openReminders, 'reminder')} on the calendar`
          : 'Put the first seasonal job on the calendar',
      group: 'essentials',
      earned: openReminders > 0 ? 20 : 0,
      possible: 20,
      done: openReminders > 0,
      href: '/maintenance'
    }
  ];

  // The long tail. Counted, never fractioned — there is no total number of
  // belongings a home is supposed to have.
  const deepening: CompletenessCheck[] = [
    {
      id: 'inventory',
      label: 'Belongings recorded',
      detail:
        assets.length > 0
          ? countLabel(assets.length, 'item')
          : 'Start with the big-ticket things',
      group: 'deepening',
      earned: ratioPoints(assets.length, INVENTORY_TARGET, 15),
      possible: 15,
      done: assets.length >= INVENTORY_TARGET,
      href: '/inventory'
    },
    {
      id: 'serials',
      label: 'Serial numbers',
      detail:
        assetsWithSerial > 0
          ? countLabel(assetsWithSerial, 'serial number')
          : 'What an insurer asks for first',
      group: 'deepening',
      earned: ratioPoints(assetsWithSerial, INVENTORY_TARGET, 10),
      possible: 10,
      done: assetsWithSerial >= INVENTORY_TARGET,
      href: '/inventory'
    },
    {
      id: 'values',
      label: 'Values',
      detail:
        assetsWithValue > 0
          ? `${countLabel(assetsWithValue, 'item')} valued`
          : 'Values make the inventory claim-ready',
      group: 'deepening',
      earned: ratioPoints(assetsWithValue, INVENTORY_TARGET, 10),
      possible: 10,
      done: assetsWithValue >= INVENTORY_TARGET,
      href: '/inventory'
    },
    {
      id: 'photos',
      label: 'Photographs',
      detail:
        assetIdsWithPhotos.size > 0
          ? `${countLabel(assetIdsWithPhotos.size, 'item')} photographed`
          : 'A photo is proof of ownership',
      group: 'deepening',
      earned: ratioPoints(assetIdsWithPhotos.size, INVENTORY_TARGET, 10),
      possible: 10,
      done: assetIdsWithPhotos.size >= INVENTORY_TARGET,
      href: '/inventory'
    },
    {
      id: 'papers',
      label: 'Papers filed',
      detail:
        documents.length > 0
          ? countLabel(documents.length, 'document')
          : 'Manuals, receipts, insurance, the closing pack',
      group: 'deepening',
      earned: ratioPoints(documents.length, PAPERS_TARGET, 10),
      possible: 10,
      done: documents.length >= PAPERS_TARGET,
      href: '/documents'
    }
  ];

  const checks = [...essentials, ...deepening];

  const totalPossible = checks.reduce((sum, check) => sum + check.possible, 0);
  const totalEarned = checks.reduce((sum, check) => sum + check.earned, 0);
  const score = Math.round((totalEarned / totalPossible) * 100);

  // Essentials always outrank the tail, however few points separate them:
  // a missing water shut-off matters more than a tenth photograph.
  const nextActions = [
    ...essentials.filter((check) => !check.done),
    ...deepening.filter((check) => !check.done)
  ].slice(0, 3);

  return {
    score,
    checks,
    essentials,
    deepening,
    sealed: essentials.every((check) => check.done),
    nextActions
  };
}

// ---------- This Week at Home digest ----------

export type DigestItem = {
  id: string;
  kind: 'overdue' | 'due_soon' | 'warranty' | 'service';
  title: string;
  detail: string;
  href: string;
};

type DigestInput = {
  reminders: ReminderRow[];
  assets: AssetRow[];
  serviceRecords: ServiceRecordRow[];
  repairs: RepairRow[];
};

function localToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysUntil(dateString: string | null, from: Date) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function dueLabel(days: number) {
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return 'due yesterday';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

export function computeDigest(input: DigestInput): DigestItem[] {
  const today = localToday();
  const items: DigestItem[] = [];

  for (const reminder of input.reminders) {
    if (reminder.status !== 'open') continue;
    const days = daysUntil(reminder.due_date, today);
    if (days === null) continue;

    if (days < 0) {
      items.push({
        id: `reminder-${reminder.id}`,
        kind: 'overdue',
        title: reminder.title,
        detail: dueLabel(days),
        href: '/reminders'
      });
    } else if (days <= 14) {
      items.push({
        id: `reminder-${reminder.id}`,
        kind: 'due_soon',
        title: reminder.title,
        detail: dueLabel(days),
        href: '/reminders'
      });
    }
  }

  for (const asset of input.assets) {
    const days = daysUntil(asset.warranty_expires_at, today);
    if (days === null || days < 0 || days > 60) continue;
    items.push({
      id: `warranty-${asset.id}`,
      kind: 'warranty',
      title: `${asset.name} warranty`,
      detail: days === 0 ? 'expires today' : `expires in ${days} days`,
      href: `/assets/${asset.id}`
    });
  }

  for (const record of input.serviceRecords) {
    const days = daysUntil(record.next_service_date, today);
    if (days === null || days < -30 || days > 30) continue;
    items.push({
      id: `service-${record.id}`,
      kind: 'service',
      title: record.service_title || 'Service due',
      detail: days < 0 ? `service was due ${Math.abs(days)} days ago` : dueLabel(days),
      href: '/maintenance'
    });
  }

  const kindOrder: Record<DigestItem['kind'], number> = {
    overdue: 0,
    due_soon: 1,
    service: 2,
    warranty: 3
  };

  return items.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]).slice(0, 8);
}
