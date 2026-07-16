// Home-completeness score + "This Week at Home" digest.
// Pure client-side computation over data every page already loads — no queries,
// no background jobs, no cost. The score rewards the records that matter most
// in an emergency or a claim; the digest surfaces what needs attention now.

import type { AssetRow } from './assets';
import type { DocumentRow } from './documents';
import type { ReminderRow } from './reminders';
import type { RepairRow } from './repairs';
import type { ServiceRecordRow } from './serviceRecords';
import type { UtilityRow } from './utilities';

export type CompletenessCheck = {
  id: string;
  label: string;
  detail: string;
  earned: number;
  possible: number;
  done: boolean;
  href: string;
};

export type CompletenessResult = {
  score: number; // 0-100
  checks: CompletenessCheck[];
  nextActions: CompletenessCheck[]; // top incomplete checks, biggest wins first
};

type CompletenessInput = {
  roomCount: number;
  utilities: UtilityRow[];
  assets: AssetRow[];
  documents: DocumentRow[];
  reminders: ReminderRow[];
};

function ratioPoints(numerator: number, denominator: number, possible: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * possible);
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

  const checks: CompletenessCheck[] = [
    {
      id: 'rooms',
      label: 'Rooms mapped',
      detail: roomCount > 0 ? `${roomCount} rooms recorded` : 'Map your floors and rooms',
      earned: roomCount > 0 ? 15 : 0,
      possible: 15,
      done: roomCount > 0,
      href: '/add-rooms'
    },
    {
      id: 'water',
      label: 'Water shut-off recorded',
      detail: hasWaterShutoff
        ? 'Main water shut-off is on file'
        : 'The one record that matters in a burst-pipe emergency',
      earned: hasWaterShutoff ? 15 : 0,
      possible: 15,
      done: hasWaterShutoff,
      href: '/add-utility'
    },
    {
      id: 'electrical',
      label: 'Electrical panel recorded',
      detail: hasElectricalPanel ? 'Panel location is on file' : 'Record where the breaker panel lives',
      earned: hasElectricalPanel ? 10 : 0,
      possible: 10,
      done: hasElectricalPanel,
      href: '/add-utility'
    },
    {
      id: 'inventory',
      label: 'Inventory started',
      detail:
        assets.length >= 10
          ? `${assets.length} items recorded`
          : `${assets.length}/10 items — record the big-ticket things first`,
      earned: Math.min(15, ratioPoints(assets.length, 10, 15)),
      possible: 15,
      done: assets.length >= 10,
      href: '/inventory'
    },
    {
      id: 'serials',
      label: 'Serial numbers logged',
      detail:
        assets.length === 0
          ? 'Add items first, then capture serials'
          : `${assetsWithSerial}/${assets.length} items have serials`,
      earned: ratioPoints(assetsWithSerial, Math.max(assets.length, 1), 10),
      possible: 10,
      done: assets.length > 0 && assetsWithSerial === assets.length,
      href: '/inventory'
    },
    {
      id: 'values',
      label: 'Values recorded',
      detail:
        assets.length === 0
          ? 'Values make the inventory claim-ready'
          : `${assetsWithValue}/${assets.length} items have values`,
      earned: ratioPoints(assetsWithValue, Math.max(assets.length, 1), 10),
      possible: 10,
      done: assets.length > 0 && assetsWithValue === assets.length,
      href: '/inventory'
    },
    {
      id: 'photos',
      label: 'Photos attached',
      detail:
        assets.length === 0
          ? 'A photo per item is your proof of ownership'
          : `${assetIdsWithPhotos.size}/${assets.length} items have photos`,
      earned: ratioPoints(assetIdsWithPhotos.size, Math.max(assets.length, 1), 10),
      possible: 10,
      done: assets.length > 0 && assetIdsWithPhotos.size === assets.length,
      href: '/inventory'
    },
    {
      id: 'papers',
      label: 'Papers filed',
      detail:
        documents.length >= 3 ? `${documents.length} documents filed` : 'File manuals, receipts, and insurance papers',
      earned: Math.min(10, ratioPoints(documents.length, 3, 10)),
      possible: 10,
      done: documents.length >= 3,
      href: '/documents'
    },
    {
      id: 'care',
      label: 'Care planned',
      detail:
        openReminders > 0 ? `${openReminders} open reminders keep care on schedule` : 'Set a first maintenance reminder',
      earned: openReminders > 0 ? 5 : 0,
      possible: 5,
      done: openReminders > 0,
      href: '/reminders'
    }
  ];

  const totalPossible = checks.reduce((sum, check) => sum + check.possible, 0);
  const totalEarned = checks.reduce((sum, check) => sum + check.earned, 0);
  const score = Math.round((totalEarned / totalPossible) * 100);

  const nextActions = checks
    .filter((check) => !check.done)
    .sort((a, b) => b.possible - b.earned - (a.possible - a.earned))
    .slice(0, 3);

  return { score, checks, nextActions };
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
