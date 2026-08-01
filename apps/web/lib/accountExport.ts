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

import { safeFileName } from '@home-folder/shared';
import { strToU8, zipSync, type Zippable } from 'fflate';
import { getAssetsForContext, type AssetDataContext, type AssetRow } from './assets';
import {
  getDevicesForContext,
  getHubsForContext,
  getNetworksForContext,
  getRoutinesForContext,
  type AutomationDataContext
} from './automation';
import { getDocumentsForContext, type DocumentDataContext } from './documents';
import { getIssuesForContext, type IssueDataContext } from './issues';
import { getPropertyAddressDetails, listPropertiesForUser, type PropertySummary } from './properties';
import { getReceiptsForContext, type ReceiptDataContext } from './receipts';
import { getRemindersForContext, type ReminderDataContext } from './reminders';
import { getRepairsForContext, type RepairDataContext } from './repairs';
import { getFloorsForProperty, getRoomsForProperty } from './rooms';
import { getServiceRecordsForContext, type ServiceRecordDataContext } from './serviceRecords';
import { getSupabaseBrowserClient } from './supabase/client';
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

/** Which shape of export the README describes. */
export type ReadmeFileInfo = {
  /** True for the full zip archive, which carries the files/ folder. */
  filesIncluded: boolean;
  includedFileCount?: number;
  missingFileCount?: number;
};

/**
 * Files live in private storage and are reachable only through short-lived
 * signed URLs, so a plain JSON/CSV export can carry their metadata but not the
 * bytes. The full archive (zip) closes that gap and the README says which kind
 * it is sitting inside — saying so plainly is the difference between a real
 * backup and a false one.
 */
export function buildReadme(data: AccountExport, fileInfo?: ReadmeFileInfo): string {
  const lines: string[] = [];
  const stamp = data.generatedAt.slice(0, 10);
  const filesIncluded = fileInfo?.filesIncluded === true;

  lines.push('OUR HOME FOLDER — YOUR DATA EXPORT');
  lines.push(`Generated ${stamp}`);
  lines.push('');
  lines.push('WHAT IS IN THIS EXPORT');
  lines.push('  home-folder-export.json   Everything, in full, in one machine-readable file.');
  lines.push('  *.csv                     The same records as spreadsheets, one per section.');
  if (filesIncluded) {
    lines.push('  files/                    Your uploaded files, one folder per property.');
  }
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
  if (filesIncluded) {
    const included = fileInfo?.includedFileCount ?? 0;
    const missingCount = fileInfo?.missingFileCount ?? 0;
    lines.push('YOUR UPLOADED FILES');
    lines.push(`  The files/ folder holds your uploaded photos, manuals, receipts and`);
    lines.push(`  documents — ${included} file${included === 1 ? '' : 's'} in this archive, grouped one folder per`);
    lines.push('  property. If a file could not be downloaded while the archive was being');
    lines.push('  built, it is listed in files/MISSING.txt with the reason, rather than');
    lines.push('  silently left out — this export never claims completeness it does not have.');
    if (missingCount > 0) {
      lines.push(`  NOTE: ${missingCount} file${missingCount === 1 ? '' : 's'} could not be fetched this time — see files/MISSING.txt.`);
    }
  } else {
    lines.push('YOUR UPLOADED FILES ARE NOT IN THIS EXPORT');
    lines.push('  Photos, manuals, receipts and other uploads are stored privately and can');
    lines.push('  only be downloaded one at a time through the app. This export lists their');
    lines.push('  names, types and sizes so you know exactly what to collect, but it does not');
    lines.push('  contain the files themselves. Download anything you need from Documents');
    lines.push('  before closing your account, or use the full archive download, which');
    lines.push('  includes them.');
  }
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

/** Assets carry the values an insurer asks for; surface the total. */
export function documentedValue(assets: AssetRow[]): number {
  return assets.reduce((total, asset) => total + (asset.purchase_price ?? 0), 0);
}

// ---------------------------------------------------------------------------
// The full archive — records AND the uploaded files, in one zip (D-16).
//
// Centriq's shutdown offered CSV but no bulk file export; users who missed the
// window lost their photos. This archive is the structural answer: everything
// above, plus a files/ folder, plus an honest MISSING.txt for anything that
// could not be fetched. The export never claims completeness it doesn't have.
// ---------------------------------------------------------------------------

/**
 * Warn (in the UI, before starting) above this total: the zip is assembled in
 * browser memory, so a very large archive deserves a heads-up, not a surprise.
 */
export const EXPORT_SIZE_WARNING_BYTES = 200 * 1024 * 1024;

export function exceedsExportSizeWarning(totalBytes: number): boolean {
  return totalBytes > EXPORT_SIZE_WARNING_BYTES;
}

export type ExportableFile = {
  documentId: string;
  propertyNickname: string | null;
  title: string;
  fileName: string;
  filePath: string;
  bucketName: string;
  fileSizeBytes: number | null;
};

export function totalFileSizeBytes(files: Array<Pick<ExportableFile, 'fileSizeBytes'>>): number {
  return files.reduce((total, file) => total + (file.fileSizeBytes ?? 0), 0);
}

/** Property nickname -> a stable, filesystem-friendly folder name. */
function slugifyFolderName(value: string | null | undefined): string {
  const slug = (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');

  return slug || 'property';
}

/** Strip characters that break paths on common filesystems; keep it readable. */
function sanitizeZipEntryName(value: string): string {
  return value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
}

function extensionOf(fileName: string | null | undefined): string {
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec((fileName || '').trim());
  return match ? `.${match[1].toLowerCase()}` : '';
}

/**
 * A name is usable only when the shared safeFileName helper passes it through
 * UNCHANGED: it returns null for empty/URL-shaped names and substitutes a
 * redaction phrase for secret phrasings ("garage code…"), and a substituted
 * name is no name at all — the caller should fall back instead.
 */
function usableName(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  const safe = safeFileName(value);
  return safe === value.trim() ? safe : null;
}

/**
 * Where a document's bytes live inside the zip:
 * `files/<property-nickname-slug>/<document-title-or-file_name><ext>`.
 *
 * safeFileName() is used for NAME hygiene only (it rejects URL-shaped names and
 * names matching secret phrasings); when it declines the title we fall back to
 * the stored file name, then to "document" — the file's CONTENT is always
 * included either way, and the real title still lives in the JSON export.
 * Collisions get a numeric suffix; the original extension is preserved.
 * The caller threads one `usedPaths` set through the whole archive.
 */
export function buildExportFilePath(
  propertyNickname: string | null | undefined,
  title: string | null | undefined,
  fileName: string | null | undefined,
  usedPaths: Set<string>
): string {
  const folder = slugifyFolderName(propertyNickname);
  const extension = extensionOf(fileName);

  let base = sanitizeZipEntryName(usableName(title) || usableName(fileName) || 'document');
  if (!base) {
    base = 'document';
  }
  // Preserve the original extension without doubling it when the chosen name
  // already carries it (titles are often just the file name).
  if (extension && base.toLowerCase().endsWith(extension)) {
    base = base.slice(0, base.length - extension.length);
  }
  if (!base) {
    base = 'document';
  }

  let candidate = `files/${folder}/${base}${extension}`;
  let suffix = 2;
  while (usedPaths.has(candidate)) {
    candidate = `files/${folder}/${base}-${suffix}${extension}`;
    suffix += 1;
  }

  usedPaths.add(candidate);
  return candidate;
}

export type MissingFileEntry = {
  /** The zip path the file would have had. */
  path: string;
  title: string;
  reason: string;
};

/**
 * files/MISSING.txt — the honest manifest. A file that fails to download gets
 * a line here rather than silently vanishing from the archive.
 */
export function buildMissingManifest(entries: MissingFileEntry[]): string {
  const lines: string[] = [];
  lines.push('FILES THAT COULD NOT BE INCLUDED');
  lines.push('  Each file below exists in your record but could not be downloaded while');
  lines.push('  this archive was being built. Nothing was deleted — try the export again,');
  lines.push('  or download these individually from Documents in the app.');
  lines.push('');

  for (const entry of entries) {
    lines.push(`  ${entry.path}`);
    lines.push(`    title:  ${entry.title}`);
    lines.push(`    reason: ${entry.reason}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Every uploaded file the signed-in user can read, across ALL their properties
 * (the documents query carries no property filter — Row-Level Security scopes
 * it). Property nicknames come along so the zip can group files per property.
 */
export async function listExportableFiles(userId: string): Promise<ExportableFile[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  // Nicknames are a nicety; a failure here must not block the file export.
  const properties = await listPropertiesForUser(userId).catch(() => [] as PropertySummary[]);
  const nicknameByPropertyId = new Map(properties.map((entry) => [entry.id, entry.nickname]));

  const { data, error } = await supabase
    .from('documents')
    .select('id, property_id, title, file_name, file_path, bucket_name, file_size_bytes')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(2000);

  if (error) {
    throw new Error(`Could not list your uploaded files: ${error.message}`);
  }

  type FileRow = {
    id: string;
    property_id: string;
    title: string | null;
    file_name: string | null;
    file_path: string | null;
    bucket_name: string | null;
    file_size_bytes: number | null;
  };

  return ((data ?? []) as FileRow[])
    .filter((row) => typeof row.file_path === 'string' && row.file_path.length > 0)
    .map((row) => ({
      documentId: row.id,
      propertyNickname: nicknameByPropertyId.get(row.property_id) ?? null,
      title: row.title?.trim() || row.file_name?.trim() || 'Untitled document',
      fileName: row.file_name?.trim() || 'document',
      filePath: row.file_path as string,
      bucketName: row.bucket_name || 'home-documents',
      fileSizeBytes:
        typeof row.file_size_bytes === 'number' && Number.isFinite(row.file_size_bytes)
          ? row.file_size_bytes
          : null
    }));
}

export type ArchiveBuildResult = {
  zip: Uint8Array;
  includedCount: number;
  missing: MissingFileEntry[];
};

/**
 * Build the one-zip archive: JSON + per-section CSVs + README + files/ (+
 * files/MISSING.txt when anything failed). Files are fetched one at a time
 * through short-lived signed URLs — the same access path the app itself uses —
 * and a failure degrades to a MISSING.txt line, never to a silent gap.
 *
 * zipSync is deliberate: exports are small at this stage, and callers warn the
 * user first (EXPORT_SIZE_WARNING_BYTES) when the total argues otherwise.
 */
export async function buildArchiveZip(
  data: AccountExport,
  files: ExportableFile[],
  onFileProgress?: (current: number, total: number) => void
): Promise<ArchiveBuildResult> {
  const supabase = getSupabaseBrowserClient();
  const entries: Zippable = {};
  const usedPaths = new Set<string>();
  const missing: MissingFileEntry[] = [];
  let includedCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onFileProgress?.(index + 1, files.length);

    const zipPath = buildExportFilePath(file.propertyNickname, file.title, file.fileName, usedPaths);

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured.');
      }

      const { data: signed, error: signError } = await supabase.storage
        .from(file.bucketName)
        .createSignedUrl(file.filePath, 300);

      if (signError || !signed?.signedUrl) {
        throw new Error(signError?.message || 'could not create a download link');
      }

      const response = await fetch(signed.signedUrl);
      if (!response.ok) {
        throw new Error(`download failed (HTTP ${response.status})`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      // Uploads are already-compressed formats (JPEG/PNG/WebP/PDF); store them
      // uncompressed so building the zip stays fast.
      entries[zipPath] = [bytes, { level: 0 }];
      includedCount += 1;
    } catch (error) {
      missing.push({
        path: zipPath,
        title: file.title,
        reason: error instanceof Error ? error.message : 'unknown error'
      });
    }
  }

  entries['README.txt'] = strToU8(
    buildReadme(data, {
      filesIncluded: true,
      includedFileCount: includedCount,
      missingFileCount: missing.length
    })
  );
  entries['home-folder-export.json'] = strToU8(JSON.stringify(data, null, 2));
  for (const sheet of buildCsvSheets(data)) {
    entries[`${sheet.name}.csv`] = strToU8(sheet.contents);
  }
  if (missing.length > 0) {
    entries['files/MISSING.txt'] = strToU8(buildMissingManifest(missing));
  }

  return { zip: zipSync(entries, { level: 6 }), includedCount, missing };
}

export function downloadBinaryFile(filename: string, bytes: Uint8Array, mime = 'application/zip') {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
