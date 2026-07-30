// Moving a signed-out demo home into a real account.
//
// Before this existed, someone could spend half an hour mapping their house
// while signed out, click "Sign up" because the app told them that is how the
// record gets saved, and land on an empty dashboard. The data was still in
// localStorage — invisible, unreachable, and reappearing if they signed out
// again, which reads as the app having lost their work.
//
// Order matters: rooms are created first so every child record can be
// re-pointed from its old local id to the new database id.

import { getDemoActiveProperty, getDemoRooms } from './demoStorage';
import { createRoomsForProperty, getRoomsForProperty } from './rooms';
import { getDemoUtilities, createUtilityForContext, type UtilityDataContext } from './utilities';
import { getDemoAssets, createAssetForContext, type AssetDataContext } from './assets';
import { getDemoReminders, createReminderForContext, type ReminderDataContext } from './reminders';
import { getDemoRepairs, createRepairForContext, type RepairDataContext } from './repairs';
import {
  getDemoServiceRecords,
  createServiceRecordForContext,
  type ServiceRecordDataContext
} from './serviceRecords';
import { getDemoIssues, createIssueForContext, type IssueDataContext } from './issues';

const DEMO_KEYS = [
  'homeFolder.activeProperty',
  'homeFolder.rooms',
  'homeFolder.utilities',
  'homeFolder.assets',
  'homeFolder.reminders',
  'homeFolder.repairs',
  'homeFolder.serviceRecords',
  'homeFolder.issues',
  'homeFolder.trendFlags'
] as const;

export type DemoSummary = {
  hasAnything: boolean;
  propertyNickname: string | null;
  counts: Record<string, number>;
  total: number;
};

/** What is sitting in this browser that an account does not yet have. */
export function summarizeDemoData(): DemoSummary {
  const counts: Record<string, number> = {
    'rooms & spaces': getDemoRooms().length,
    utilities: getDemoUtilities().length,
    assets: getDemoAssets().length,
    reminders: getDemoReminders().length,
    repairs: getDemoRepairs().length,
    'service records': getDemoServiceRecords().length,
    issues: getDemoIssues().length
  };

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const property = getDemoActiveProperty();

  return {
    hasAnything: total > 0,
    propertyNickname: property?.nickname ?? null,
    counts,
    total
  };
}

export type ImportContexts = {
  utility: UtilityDataContext;
  asset: AssetDataContext;
  reminder: ReminderDataContext;
  repair: RepairDataContext;
  serviceRecord: ServiceRecordDataContext;
  issue: IssueDataContext;
};

export type ImportResult = {
  imported: Record<string, number>;
  failed: Record<string, number>;
  total: number;
};

/** Clear demo storage. Only ever called after a successful import. */
export function clearDemoData(): void {
  if (typeof window === 'undefined') {
    return;
  }

  for (const key of DEMO_KEYS) {
    window.localStorage.removeItem(key);
  }
}

/**
 * Copy this browser's demo home into the signed-in account's property.
 *
 * Each record is created independently so one bad row cannot abort the whole
 * import; the caller is told exactly how many of each kind moved and how many
 * did not, and demo storage is only cleared when nothing failed.
 */
export async function importDemoDataIntoAccount(
  propertyId: string,
  contexts: ImportContexts
): Promise<ImportResult> {
  const imported: Record<string, number> = {};
  const failed: Record<string, number> = {};

  const note = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] || 0) + 1;
  };

  // 1. Rooms first — everything else may reference them.
  const demoRooms = getDemoRooms();
  const roomIdMap = new Map<string, string>();

  if (demoRooms.length > 0) {
    const created = await createRoomsForProperty(
      propertyId,
      demoRooms.map((room) => ({
        name: room.name,
        room_type: room.room_type as never,
        floor_name: room.floor_name || 'Main Floor'
      }))
    );

    const byName = new Map(created.map((room) => [room.name.trim().toLowerCase(), room.id]));
    for (const room of demoRooms) {
      const newId = byName.get(room.name.trim().toLowerCase());
      if (newId) {
        roomIdMap.set(room.id, newId);
        note(imported, 'rooms & spaces');
      } else {
        note(failed, 'rooms & spaces');
      }
    }
  }

  const mapRoom = (oldId: string | null | undefined) =>
    oldId ? roomIdMap.get(oldId) ?? null : null;

  // 2. Utilities and assets, re-pointed at their new rooms.
  const utilityIdMap = new Map<string, string>();
  for (const utility of getDemoUtilities()) {
    try {
      const created = await createUtilityForContext(contexts.utility, {
        utility_type: utility.utility_type,
        name: utility.name,
        room_id: mapRoom(utility.room_id),
        location_notes: utility.location_notes,
        emergency_notes: utility.emergency_notes
      });
      utilityIdMap.set(utility.id, created.id);
      note(imported, 'utilities');
    } catch {
      note(failed, 'utilities');
    }
  }

  const assetIdMap = new Map<string, string>();
  for (const asset of getDemoAssets()) {
    try {
      const created = await createAssetForContext(contexts.asset, {
        name: asset.name,
        asset_type: asset.asset_type,
        room_id: mapRoom(asset.room_id),
        brand: asset.brand,
        model: asset.model,
        serial_number: asset.serial_number,
        purchase_date: asset.purchase_date,
        purchase_price: asset.purchase_price,
        retailer: asset.retailer,
        warranty_length_months: asset.warranty_length_months,
        warranty_expires_at: asset.warranty_expires_at,
        manual_url: asset.manual_url,
        support_url: asset.support_url,
        notes: asset.notes
      });
      assetIdMap.set(asset.id, created.id);
      note(imported, 'assets');
    } catch {
      note(failed, 'assets');
    }
  }

  const mapUtility = (oldId: string | null | undefined) =>
    oldId ? utilityIdMap.get(oldId) ?? null : null;
  const mapAsset = (oldId: string | null | undefined) => (oldId ? assetIdMap.get(oldId) ?? null : null);

  // 3. Everything that hangs off the above.
  for (const reminder of getDemoReminders()) {
    try {
      await createReminderForContext(contexts.reminder, {
        title: reminder.title,
        description: reminder.description,
        reminder_type: reminder.reminder_type,
        status: reminder.status,
        priority: reminder.priority,
        due_date: reminder.due_date,
        frequency: reminder.frequency,
        room_id: mapRoom(reminder.room_id),
        asset_id: mapAsset(reminder.asset_id),
        utility_id: mapUtility(reminder.utility_id)
      });
      note(imported, 'reminders');
    } catch {
      note(failed, 'reminders');
    }
  }

  const repairIdMap = new Map<string, string>();
  for (const repair of getDemoRepairs()) {
    try {
      const created = await createRepairForContext(contexts.repair, {
        title: repair.title,
        description: repair.description,
        repair_type: repair.repair_type,
        status: repair.status,
        priority: repair.priority,
        reported_date: repair.reported_date,
        completed_date: repair.completed_date,
        scheduled_date: repair.scheduled_date,
        scheduled_window: repair.scheduled_window,
        contractor_name: repair.contractor_name,
        contractor_phone: repair.contractor_phone,
        contractor_email: repair.contractor_email,
        estimated_cost: repair.estimated_cost,
        actual_cost: repair.actual_cost,
        notes: repair.notes,
        room_id: mapRoom(repair.room_id),
        asset_id: mapAsset(repair.asset_id),
        utility_id: mapUtility(repair.utility_id)
      });
      repairIdMap.set(repair.id, created.id);
      note(imported, 'repairs');
    } catch {
      note(failed, 'repairs');
    }
  }

  for (const record of getDemoServiceRecords()) {
    try {
      await createServiceRecordForContext(contexts.serviceRecord, {
        service_title: record.service_title,
        service_type: record.service_type,
        service_date: record.service_date,
        provider_name: record.provider_name,
        provider_phone: record.provider_phone,
        provider_email: record.provider_email,
        cost: record.cost,
        summary: record.summary,
        notes: record.notes,
        next_service_date: record.next_service_date,
        room_id: mapRoom(record.room_id),
        asset_id: mapAsset(record.asset_id),
        utility_id: mapUtility(record.utility_id)
      });
      note(imported, 'service records');
    } catch {
      note(failed, 'service records');
    }
  }

  for (const issue of getDemoIssues()) {
    try {
      await createIssueForContext(contexts.issue, {
        title: issue.title,
        description: issue.description,
        issue_type: issue.issue_type,
        status: issue.status,
        severity: issue.severity,
        first_seen_date: issue.first_seen_date,
        last_seen_date: issue.last_seen_date,
        resolved_date: issue.resolved_date,
        notes: issue.notes,
        room_id: mapRoom(issue.room_id),
        asset_id: mapAsset(issue.asset_id),
        utility_id: mapUtility(issue.utility_id)
      });
      note(imported, 'issues');
    } catch {
      note(failed, 'issues');
    }
  }

  // Confirm the rooms landed before reporting success on them.
  await getRoomsForProperty(propertyId);

  const total = Object.values(imported).reduce((sum, n) => sum + n, 0);
  return { imported, failed, total };
}
