import type { User } from '@supabase/supabase-js';
import { getWarrantyMeta, type VisibilityContext, type WarrantyStatus } from '@home-folder/shared';
import { normalizeVisibilityContexts } from './visibility';
import { getCurrentUser, isSupabaseConfigured, getCurrentUserUncached } from './auth';
import { getAssetsForProperty, getDemoAssets, type AssetRow } from './assets';
import { getDemoActiveProperty, getDemoRooms } from './demoStorage';
import { getDemoDocuments, getDocumentsForProperty, type DocumentRow } from './documents';
import { getDemoIssues, getIssuesForProperty, type IssueRow } from './issues';
import { getPrimaryPropertyForUser, type PropertySummary } from './properties';
import { getDemoReceipts, getReceiptsForProperty, type ReceiptRow } from './receipts';
import { getDemoReminders, getRemindersForProperty, type ReminderRow } from './reminders';
import { getDemoRepairs, getRepairsForProperty, type RepairRow } from './repairs';
import { getFloorsForProperty, getRoomsForProperty, type FloorRow, type RoomWithFloor } from './rooms';
import { getDemoServiceRecords, getServiceRecordsForProperty, type ServiceRecordRow } from './serviceRecords';
import { getDemoTrendFlags, getTrendFlagsForProperty, type TrendFlagRow } from './trendFlags';
import { getDemoUtilities, getUtilitiesForProperty, type UtilityRow } from './utilities';

export const HANDOVER_REPORT_TYPES = [
  'family',
  'buyer',
  'maintenance',
  'insurance',
  'personal_archive'
] as const;

export const HANDOVER_SECTIONS = [
  'property_summary',
  'rooms',
  'utilities',
  'assets',
  'warranties',
  'reminders',
  'repairs',
  'service_records',
  'issues',
  'trend_flags',
  'documents_summary',
  'receipts_summary',
  'emergency_overview'
] as const;

export type HandoverReportType = (typeof HANDOVER_REPORT_TYPES)[number];
export type HandoverSection = (typeof HANDOVER_SECTIONS)[number];
export type HandoverMode = 'demo' | 'supabase';

export type HandoverContext = {
  mode: HandoverMode;
  supabaseConfigured: boolean;
  user: User | null;
  property: PropertySummary | null;
};

export type HandoverReportInput = {
  reportType: HandoverReportType;
  sections: HandoverSection[];
};

export type HandoverReportData = HandoverReportInput & {
  context: HandoverContext;
  generatedAt: string;
  floors: FloorRow[];
  rooms: RoomWithFloor[];
  utilities: UtilityRow[];
  assets: AssetRow[];
  reminders: ReminderRow[];
  repairs: RepairRow[];
  serviceRecords: ServiceRecordRow[];
  issues: IssueRow[];
  trendFlags: TrendFlagRow[];
  documents: DocumentRow[];
  receipts: ReceiptRow[];
  sectionErrors: string[];
  /** Present only for the insurance report type; null for every other type. */
  claimInventory: ClaimInventory | null;
};

export type ClaimInventoryValueSource = 'purchase_price' | 'receipt';

export type ClaimInventoryItem = {
  assetId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  retailer: string | null;
  warrantyStatus: WarrantyStatus;
  /** Sum of amounts on approved receipts linked to this asset; null when none carry an amount. */
  receiptAmount: number | null;
  /** purchase_price when set, otherwise the linked receipt amount — never both. Null when neither exists. */
  documentedValue: number | null;
  valueSource: ClaimInventoryValueSource | null;
  receiptCount: number;
  documentCount: number;
  evidenceCount: number;
};

export type ClaimInventoryTotals = {
  itemCount: number;
  /** Sum of documentedValue across items. Items without a documented value contribute nothing. */
  documentedValueTotal: number;
  itemsWithValue: number;
  itemsWithoutValue: number;
};

export type ClaimMaintenanceSummary = {
  serviceRecordCount: number;
  earliestServiceDate: string | null;
  latestServiceDate: string | null;
};

export type ClaimInventory = {
  items: ClaimInventoryItem[];
  totals: ClaimInventoryTotals;
  maintenance: ClaimMaintenanceSummary;
};

/**
 * Assemble the adjuster-ready claim inventory for the insurance report type.
 *
 * Pure function: no loading, no dates invented, no values estimated. An item's
 * documented value is its recorded purchase price when one exists, otherwise
 * the summed amount of approved receipts linked to it via receipt.asset_id —
 * one source or the other, never both. Items with neither are counted
 * separately so the report can say so honestly instead of guessing.
 */
export function buildClaimInventory(
  assets: AssetRow[],
  receipts: ReceiptRow[],
  documents: DocumentRow[],
  serviceRecords: ServiceRecordRow[]
): ClaimInventory {
  // Only approved receipts count as claim evidence — same rule the report
  // preview already applies to the receipts summary section.
  const receiptsByAsset = new Map<string, ReceiptRow[]>();
  for (const receipt of receipts) {
    if (receipt.approval_status !== 'approved' || !receipt.asset_id) {
      continue;
    }
    const list = receiptsByAsset.get(receipt.asset_id);
    if (list) {
      list.push(receipt);
    } else {
      receiptsByAsset.set(receipt.asset_id, [receipt]);
    }
  }

  const documentCountByAsset = new Map<string, number>();
  for (const document of documents) {
    if (!document.asset_id) {
      continue;
    }
    documentCountByAsset.set(document.asset_id, (documentCountByAsset.get(document.asset_id) || 0) + 1);
  }

  let documentedValueTotal = 0;
  let itemsWithValue = 0;

  const items: ClaimInventoryItem[] = assets.map((asset) => {
    const linkedReceipts = receiptsByAsset.get(asset.id) || [];
    const receiptAmounts = linkedReceipts
      .map((receipt) => receipt.total_amount)
      .filter((amount): amount is number => amount !== null);
    const receiptAmount =
      receiptAmounts.length > 0 ? receiptAmounts.reduce((sum, amount) => sum + amount, 0) : null;

    let documentedValue: number | null = null;
    let valueSource: ClaimInventoryValueSource | null = null;

    if (asset.purchase_price !== null) {
      documentedValue = asset.purchase_price;
      valueSource = 'purchase_price';
    } else if (receiptAmount !== null) {
      documentedValue = receiptAmount;
      valueSource = 'receipt';
    }

    if (documentedValue !== null) {
      documentedValueTotal += documentedValue;
      itemsWithValue += 1;
    }

    const documentCount = documentCountByAsset.get(asset.id) || 0;

    return {
      assetId: asset.id,
      name: asset.name,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serial_number,
      purchaseDate: asset.purchase_date,
      purchasePrice: asset.purchase_price,
      retailer: asset.retailer,
      warrantyStatus: getWarrantyMeta(asset).status,
      receiptAmount,
      documentedValue,
      valueSource,
      receiptCount: linkedReceipts.length,
      documentCount,
      evidenceCount: linkedReceipts.length + documentCount
    };
  });

  // ISO date-only strings sort correctly as plain strings.
  const serviceDates = serviceRecords
    .map((record) => record.service_date)
    .filter((date) => Boolean(date))
    .sort();

  return {
    items,
    totals: {
      itemCount: assets.length,
      documentedValueTotal,
      itemsWithValue,
      itemsWithoutValue: assets.length - itemsWithValue
    },
    maintenance: {
      serviceRecordCount: serviceRecords.length,
      earliestServiceDate: serviceDates.length > 0 ? serviceDates[0] : null,
      latestServiceDate: serviceDates.length > 0 ? serviceDates[serviceDates.length - 1] : null
    }
  };
}

export const HANDOVER_SECTION_LABELS: Record<HandoverSection, string> = {
  property_summary: 'Property summary',
  rooms: 'Rooms',
  utilities: 'Utilities',
  assets: 'Assets',
  warranties: 'Warranties',
  reminders: 'Reminders',
  repairs: 'Repairs',
  service_records: 'Service History',
  issues: 'Issues',
  trend_flags: 'Trends',
  documents_summary: 'Documents summary',
  receipts_summary: 'Receipts summary',
  emergency_overview: 'Emergency overview'
};

export const HANDOVER_REPORT_TYPE_LABELS: Record<HandoverReportType, string> = {
  family: 'Family handoff',
  buyer: 'Buyer handoff',
  maintenance: 'Maintenance reference',
  insurance: 'Insurance / claim-ready',
  personal_archive: 'Personal archive'
};

const DEFAULT_SECTIONS_BY_REPORT_TYPE: Record<HandoverReportType, HandoverSection[]> = {
  family: [
    'property_summary',
    'rooms',
    'utilities',
    'assets',
    'warranties',
    'reminders',
    'repairs',
    'service_records',
    'documents_summary',
    'emergency_overview'
  ],
  buyer: [
    'property_summary',
    'rooms',
    'utilities',
    'assets',
    'warranties',
    'repairs',
    'service_records',
    'issues',
    'documents_summary'
  ],
  maintenance: [
    'property_summary',
    'rooms',
    'utilities',
    'assets',
    'reminders',
    'repairs',
    'service_records',
    'issues',
    'emergency_overview'
  ],
  insurance: [
    'property_summary',
    'rooms',
    'assets',
    'warranties',
    'repairs',
    'service_records',
    'issues',
    'documents_summary',
    'receipts_summary'
  ],
  personal_archive: [...HANDOVER_SECTIONS]
};

/**
 * Keep only the entries marked for this report's audience. The report types
 * are the visibility contexts: a family pack shows family-context entries, a
 * buyer pack shows buyer-context entries, and an entry marked only for the
 * personal archive stays out of every shared pack. The personal archive
 * report is the keeper's own complete record, so nothing is held back there.
 */
export function filterEntriesForReportType<T extends { visibility_contexts: VisibilityContext[] }>(
  entries: T[],
  reportType: HandoverReportType
): T[] {
  if (reportType === 'personal_archive') {
    return entries;
  }

  return entries.filter((entry) =>
    normalizeVisibilityContexts(entry.visibility_contexts).includes(reportType)
  );
}

function buildDemoProperty(): PropertySummary | null {
  const demoProperty = getDemoActiveProperty();

  if (!demoProperty) {
    return null;
  }

  return {
    id: demoProperty.id,
    household_id: 'demo',
    owner_user_id: 'demo',
    nickname: demoProperty.nickname,
    property_type: demoProperty.property_type,
    created_at: demoProperty.created_at,
    parent_property_id: null,
    unit_label: null
  };
}

function buildDemoFloors(propertyId: string, rooms: RoomWithFloor[]): FloorRow[] {
  const floorNames = Array.from(new Set(rooms.map((room) => room.floor_name || 'Unassigned')));

  return floorNames.map((name, index) => ({
    id: `demo-floor-${index}`,
    property_id: propertyId,
    name,
    floor_number: index,
    sort_order: index
  }));
}

function getDemoRoomsWithFloors(): RoomWithFloor[] {
  return getDemoRooms().map((room) => ({
    id: room.id,
    name: room.name,
    room_type: room.room_type,
    floor_name: room.floor_name || 'Unassigned',
    floor_id: null
  }));
}

async function safeLoad<T>(
  section: HandoverSection,
  loader: () => Promise<T[]>,
  sectionErrors: string[]
) {
  try {
    return await loader();
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to load ${HANDOVER_SECTION_LABELS[section]}.`;
    sectionErrors.push(`${HANDOVER_SECTION_LABELS[section]}: ${message}`);
    return [] as T[];
  }
}

export function getDefaultHandoverSections(reportType: HandoverReportType) {
  return [...DEFAULT_SECTIONS_BY_REPORT_TYPE[reportType]];
}

export async function getHandoverContext(): Promise<HandoverContext> {
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: buildDemoProperty()
    };
  }

  // A cached `null` from a moment earlier -- mid sign-out -> sign-in -- used to
  // read as "signed out", and signed-out means demo mode, which means this
  // person's next save goes to browser storage instead of their account and
  // is quietly lost. Confirm against the auth client before concluding that.
  const user = (await getCurrentUser()) ?? (await getCurrentUserUncached());

  if (!user) {
    return {
      mode: 'demo',
      supabaseConfigured,
      user: null,
      property: buildDemoProperty()
    };
  }

  return {
    mode: 'supabase',
    supabaseConfigured,
    user,
    property: await getPrimaryPropertyForUser(user.id)
  };
}

export async function loadHandoverReport(input: HandoverReportInput): Promise<HandoverReportData> {
  const context = await getHandoverContext();
  const sectionSet = new Set(input.sections);
  const sectionErrors: string[] = [];
  // The insurance report always assembles the claim inventory, so the data it
  // depends on is loaded even when those sections are toggled off.
  const isInsurance = input.reportType === 'insurance';

  const emptyReport: HandoverReportData = {
    ...input,
    context,
    generatedAt: new Date().toISOString(),
    floors: [],
    rooms: [],
    utilities: [],
    assets: [],
    reminders: [],
    repairs: [],
    serviceRecords: [],
    issues: [],
    trendFlags: [],
    documents: [],
    receipts: [],
    sectionErrors,
    claimInventory: null
  };

  if (!context.property) {
    return emptyReport;
  }

  const needsRooms =
    sectionSet.has('property_summary') ||
    sectionSet.has('rooms') ||
    sectionSet.has('utilities') ||
    sectionSet.has('assets') ||
    sectionSet.has('reminders') ||
    sectionSet.has('repairs') ||
    sectionSet.has('service_records') ||
    sectionSet.has('issues') ||
    sectionSet.has('trend_flags') ||
    sectionSet.has('documents_summary') ||
    sectionSet.has('receipts_summary') ||
    sectionSet.has('emergency_overview');
  const needsUtilities = sectionSet.has('utilities') || sectionSet.has('emergency_overview');
  const needsAssets = sectionSet.has('assets') || sectionSet.has('warranties') || isInsurance;
  const needsReminders = sectionSet.has('reminders');
  const needsRepairs = sectionSet.has('repairs') || sectionSet.has('emergency_overview');
  const needsServiceRecords = sectionSet.has('service_records') || isInsurance;
  const needsIssues = sectionSet.has('issues') || sectionSet.has('emergency_overview');
  const needsTrendFlags = sectionSet.has('trend_flags');
  const needsDocuments = sectionSet.has('documents_summary') || isInsurance;
  const needsReceipts = sectionSet.has('receipts_summary') || isInsurance;

  if (context.mode === 'demo') {
    const rooms = needsRooms ? getDemoRoomsWithFloors() : [];
    const demoAssets = needsAssets ? filterEntriesForReportType(getDemoAssets(), input.reportType) : [];
    const demoServiceRecords = needsServiceRecords ? getDemoServiceRecords() : [];
    const demoDocuments = needsDocuments
      ? filterEntriesForReportType(getDemoDocuments(), input.reportType)
      : [];
    const demoReceipts = needsReceipts ? getDemoReceipts() : [];

    return {
      ...emptyReport,
      floors: needsRooms ? buildDemoFloors(context.property.id, rooms) : [],
      rooms,
      utilities: needsUtilities ? getDemoUtilities() : [],
      assets: demoAssets,
      reminders: needsReminders ? getDemoReminders() : [],
      repairs: needsRepairs ? getDemoRepairs() : [],
      serviceRecords: demoServiceRecords,
      issues: needsIssues ? getDemoIssues() : [],
      trendFlags: needsTrendFlags ? getDemoTrendFlags() : [],
      documents: demoDocuments,
      receipts: demoReceipts,
      claimInventory: isInsurance
        ? buildClaimInventory(demoAssets, demoReceipts, demoDocuments, demoServiceRecords)
        : null
    };
  }

  const propertyId = context.property.id;
  const [floors, rooms, utilities, assets, reminders, repairs, serviceRecords, issues, trendFlags, documents, receipts] =
    await Promise.all([
      needsRooms ? safeLoad('rooms', () => getFloorsForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsRooms ? safeLoad('rooms', () => getRoomsForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsUtilities ? safeLoad('utilities', () => getUtilitiesForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsAssets ? safeLoad('assets', () => getAssetsForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsReminders ? safeLoad('reminders', () => getRemindersForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsRepairs ? safeLoad('repairs', () => getRepairsForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsServiceRecords
        ? safeLoad('service_records', () => getServiceRecordsForProperty(propertyId), sectionErrors)
        : Promise.resolve([]),
      needsIssues ? safeLoad('issues', () => getIssuesForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsTrendFlags ? safeLoad('trend_flags', () => getTrendFlagsForProperty(propertyId), sectionErrors) : Promise.resolve([]),
      needsDocuments
        ? safeLoad('documents_summary', () => getDocumentsForProperty(propertyId), sectionErrors)
        : Promise.resolve([]),
      needsReceipts ? safeLoad('receipts_summary', () => getReceiptsForProperty(propertyId), sectionErrors) : Promise.resolve([])
    ]);

  const visibleAssets = filterEntriesForReportType(assets, input.reportType);
  const visibleDocuments = filterEntriesForReportType(documents, input.reportType);

  return {
    ...emptyReport,
    floors,
    rooms,
    utilities,
    assets: visibleAssets,
    reminders,
    repairs,
    serviceRecords,
    issues,
    trendFlags,
    documents: visibleDocuments,
    receipts,
    claimInventory: isInsurance
      ? buildClaimInventory(visibleAssets, receipts, visibleDocuments, serviceRecords)
      : null
  };
}
