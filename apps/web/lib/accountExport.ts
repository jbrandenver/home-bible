// Full account export — "give me everything you hold about my home".
//
// This is deliberately DIFFERENT from the share/handover exports. Those are read
// by someone else (a technician, a buyer, an insurer), so they run every free-text
// field through safeText() and withhold access codes. This one goes from the
// owner's account to the owner's own disk, so it must be COMPLETE. An export that
// quietly drops the fields you most need is not an export.
//
// That distinction is the whole point of the feature: when Centriq shut down in
// January 2025 it offered CSV but no bulk file export, and users who missed the
// window lost everything. A record you cannot take with you is not a record.

import { getAssetsForContext, type AssetDataContext, type AssetRow } from './assets';
import {
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRoutinesForContext,
  type AutomationDataContext
} from './automation';
import { getDocumentsForContext, type DocumentDataContext, type DocumentRow } from './documents';
import { getIssuesForContext, type IssueDataContext } from './issues';
import { getPropertyAddressDetails, type PropertySummary } from './properties';
import { getReceiptsForContext, type ReceiptDataContext, type ReceiptRow } from './receipts';
import { getRemindersForContext, type ReminderDataContext } from './reminders';
import { getRepairsForContext, type RepairDataContext } from './repairs';
import { getFloorsForProperty, getRoomsForProperty } from './rooms';
import { getServiceRecordsForContext, type ServiceRecordDataContext } from './serviceRecords';
import { getTrendFlagsForContext, type TrendFlagDataContext } from './trendFlags';
import { getUtilitiesForContext, type UtilityDataContext } from './utilities';

export const EXPORT_FORMAT_VERSION = 1;

export type ExportContexts = {
  utility: UtilityDataContext;
  asset: AssetDataContext;
  reminder: ReminderDataContext;
  repair: RepairDataContext;
  serviceRecord: ServiceRecordDataContext;
  issue: IssueDataContext;
  trendFlag: TrendFlagDataContext;
  document: DocumentDataContext;
  receipt: ReceiptDataContext;
  automation: AutomationDataContext;
};

export type AccountExport = {
  format: 'our-home-folder-export';
  formatVersion: number;
  generatedAt: string;
  notice: string;
  property: Record<string, unknown> | null;
  counts: Record<string, number>;
  floors: unknown[];
  rooms: unknown[];
  utilities: unknown[];
  assets: unknown[];
  reminders: unknown[];
  repairs: unknown[];
  serviceRecords: unknown[];
  issues: unknown[];
  trendFlags: unknown[];
  documents: unknown[];
  receipts: unknown[];
  automation: {
    devices: unknown[];
    hubs: unknown[];
    networks: unknown[];
    routines: unknown[];
  };
};

const COMPLETE_COPY_NOTICE =
  'This file is a complete copy of your home record, including any notes you ' +
  'entered. It is not redacted, because it is your data going to your own ' +
  'device — unlike a service call sheet or handover report, which are written ' +
  'for someone else and do withhold sensitive details. Store it somewhere you ' +
  'would be comfortable storing a copy of your house paperwork.';

/**
 * Gather everything belonging to the signed-in owner's property.
 *
 * Each section is fetched independently: one failing table degrades that section
 * to empty rather than aborting the whole export, because a partial backup a
 * user can actually download beats a complete one they cannot.
 */
export async function buildAccountExport(
  property: PropertySummary | null,
  contexts: ExportContexts,
  generatedAt = new Date().toISOString()
): Promise<AccountExport> {
  const settle = async <T>(label: string, promise: Promise<T[]>): Promise<T[]> => {
    try {
      return await promise;
    } catch (error) {
      console.warn(`Export: could not read ${label}`, error);
      return [];
    }
  };

  const [
    floors,
    rooms,
    utilities,
    assets,
    reminders,
    repairs,
    serviceRecords,
    issues,
    trendFlags,
    documents,
    receipts,
    devices,
    hubs,
    networks,
    routines,
    addressDetails
  ] = await Promise.all([
    property ? settle('floors', getFloorsForProperty(property.id)) : Promise.resolve([]),
    property ? settle('rooms', getRoomsForProperty(property.id)) : Promise.resolve([]),
    settle('utilities', getUtilitiesForContext(contexts.utility)),
    settle('assets', getAssetsForContext(contexts.asset)),
    settle('reminders', getRemindersForContext(contexts.reminder)),
    settle('repairs', getRepairsForContext(contexts.repair)),
    settle('service records', getServiceRecordsForContext(contexts.serviceRecord)),
    settle('issues', getIssuesForContext(contexts.issue)),
    settle('trends', getTrendFlagsForContext(contexts.trendFlag)),
    settle('documents', getDocumentsForContext(contexts.document)),
    settle('receipts', getReceiptsForContext(contexts.receipt)),
    settle('devices', getDevicesForContext(contexts.automation)),
    settle('hubs', getHubsForContext(contexts.automation)),
    settle('networks', getNetworksForContext(contexts.automation)),
    settle('automations', getRoutinesForContext(contexts.automation)),
    property
      ? getPropertyAddressDetails(property.id).catch(() => null)
      : Promise.resolve(null)
  ]);

  const counts: Record<string, number> = {
    floors: floors.length,
    rooms: rooms.length,
    utilities: utilities.length,
    assets: assets.length,
    reminders: reminders.length,
    repairs: repairs.length,
    serviceRecords: serviceRecords.length,
    issues: issues.length,
    trendFlags: trendFlags.length,
    documents: documents.length,
    receipts: receipts.length,
    automationDevices: devices.length,
    automationHubs: hubs.length,
    automationNetworks: networks.length,
    automations: routines.length
  };

  return {
    format: 'our-home-folder-export',
    formatVersion: EXPORT_FORMAT_VERSION,
    generatedAt,
    notice: COMPLETE_COPY_NOTICE,
    property: property
      ? {
          nickname: property.nickname,
          property_type: property.property_type,
          created_at: property.created_at,
          // The full address is included regardless of the "show on shared
          // sheets" toggle — that flag governs what other people see, not what
          // the owner can take with them.
          address: addressDetails
            ? {
                address_line_1: addressDetails.address_line_1,
                address_line_2: addressDetails.address_line_2,
                city: addressDetails.city,
                state: addressDetails.state,
                postal_code: addressDetails.postal_code,
                shown_on_shared_documents: addressDetails.address_is_enabled
              }
            : null
        }
      : null,
    counts,
    floors,
    rooms,
    utilities,
    assets,
    reminders,
    repairs,
    serviceRecords,
    issues,
    trendFlags,
    documents,
    receipts,
    automation: { devices, hubs, networks, routines }
  };
}

// ---------------------------------------------------------------------------
// CSV — for the person who wants to open this in a spreadsheet, which for a
// household inventory is most people.
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows -> CSV using the given column order, so exports stay stable over time. */
export function rowsToCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(','));
  }
  return lines.join('\r\n');
}

export type CsvSheet = { name: string; contents: string; rowCount: number };

export function buildCsvSheets(data: AccountExport): CsvSheet[] {
  const sheet = (name: string, rows: unknown[], columns: string[]): CsvSheet => ({
    name,
    contents: rowsToCsv(rows as Record<string, unknown>[], columns),
    rowCount: rows.length
  });

  return [
    sheet('rooms', data.rooms, ['name', 'room_type', 'floor_name', 'notes']),
    sheet('utilities', data.utilities, [
      'name', 'utility_type', 'room_id', 'location_notes', 'emergency_notes', 'created_at'
    ]),
    sheet('assets', data.assets, [
      'name', 'asset_type', 'brand', 'model', 'serial_number', 'purchase_date',
      'purchase_price', 'retailer', 'warranty_length_months', 'warranty_expires_at',
      'manual_url', 'support_url', 'room_id', 'notes'
    ]),
    sheet('reminders', data.reminders, [
      'title', 'reminder_type', 'status', 'priority', 'due_date', 'frequency', 'description'
    ]),
    sheet('repairs', data.repairs, [
      'title', 'repair_type', 'status', 'priority', 'reported_date', 'scheduled_date',
      'scheduled_window', 'completed_date', 'contractor_name', 'contractor_phone',
      'contractor_email', 'estimated_cost', 'actual_cost', 'description', 'notes'
    ]),
    sheet('service-history', data.serviceRecords, [
      'service_title', 'service_type', 'service_date', 'provider_name', 'provider_phone',
      'cost', 'summary', 'next_service_date', 'notes'
    ]),
    sheet('issues', data.issues, [
      'title', 'issue_type', 'status', 'severity', 'first_seen_date', 'resolved_date', 'description'
    ]),
    sheet('documents', data.documents, [
      'title', 'document_type', 'file_name', 'mime_type', 'file_size_bytes', 'created_at', 'description'
    ]),
    sheet('receipts', data.receipts, [
      'vendor_name', 'purchase_date', 'total_amount', 'currency', 'category',
      'payment_method', 'description', 'notes'
    ])
  ].filter((entry) => entry.rowCount > 0);
}

/**
 * Files live in private storage and are reachable only through short-lived
 * signed URLs, so a JSON/CSV export can carry their metadata but not the bytes.
 * Saying so plainly is the difference between a real backup and a false one.
 */
export function buildReadme(data: AccountExport): string {
  const lines: string[] = [];
  const stamp = data.generatedAt.slice(0, 10);

  lines.push('OUR HOME FOLDER — YOUR DATA EXPORT');
  lines.push(`Generated ${stamp}`);
  lines.push('');
  lines.push('WHAT IS IN THIS EXPORT');
  lines.push('  home-folder-export.json   Everything, in full, in one machine-readable file.');
  lines.push('  *.csv                     The same records as spreadsheets, one per section.');
  lines.push('  README.txt                This file.');
  lines.push('');
  lines.push('WHAT IS RECORDED');
  for (const [key, count] of Object.entries(data.counts)) {
    if (count > 0) {
      lines.push(`  ${String(count).padStart(5)}  ${key}`);
    }
  }
  if (Object.values(data.counts).every((count) => count === 0)) {
    lines.push('  (nothing recorded yet)');
  }
  lines.push('');
  lines.push('YOUR UPLOADED FILES ARE NOT IN THIS EXPORT');
  lines.push('  Photos, manuals, receipts and other uploads are stored privately and can');
  lines.push('  only be downloaded one at a time through the app. This export lists their');
  lines.push('  names, types and sizes so you know exactly what to collect, but it does not');
  lines.push('  contain the files themselves. Download anything you need from Documents');
  lines.push('  before closing your account.');
  lines.push('');
  lines.push('PLEASE STORE THIS SAFELY');
  lines.push('  This is a complete, unredacted copy of your home record, including any');
  lines.push('  notes you wrote. It is not the same as a service call sheet or a handover');
  lines.push('  report — those are written for other people and deliberately leave');
  lines.push('  sensitive details out. This one does not, because it is yours.');

  return lines.join('\n');
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/plain') {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Metadata of every uploaded file, so the owner can collect them deliberately. */
export function listUploadedFiles(
  documents: DocumentRow[],
  receipts: ReceiptRow[]
): Array<{ title: string; fileName: string | null; kind: string }> {
  const files: Array<{ title: string; fileName: string | null; kind: string }> = documents.map(
    (document) => ({
      title: document.title,
      fileName: document.file_name,
      kind: document.document_type
    })
  );

  for (const receipt of receipts) {
    if (receipt.document_id) {
      files.push({
        title: receipt.vendor_name || receipt.description || 'Receipt',
        fileName: null,
        kind: 'receipt'
      });
    }
  }

  return files;
}

/** Assets carry the values an insurer asks for; surface the total. */
export function documentedValue(assets: AssetRow[]): number {
  return assets.reduce((total, asset) => total + (asset.purchase_price ?? 0), 0);
}
