import type { User } from '@supabase/supabase-js';
import { getCurrentUser, isSupabaseConfigured } from './auth';
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
};

export const HANDOVER_SECTION_LABELS: Record<HandoverSection, string> = {
  property_summary: 'Property summary',
  rooms: 'Rooms',
  utilities: 'Utilities',
  assets: 'Assets',
  warranties: 'Warranties',
  reminders: 'Reminders',
  repairs: 'Repairs',
  service_records: 'Service records',
  issues: 'Issues',
  trend_flags: 'Trend flags',
  documents_summary: 'Documents summary',
  receipts_summary: 'Receipts summary',
  emergency_overview: 'Emergency overview'
};

export const HANDOVER_REPORT_TYPE_LABELS: Record<HandoverReportType, string> = {
  family: 'Family handoff',
  buyer: 'Buyer handoff',
  maintenance: 'Maintenance reference',
  insurance: 'Insurance packet',
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
    created_at: demoProperty.created_at
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

  const user = await getCurrentUser();

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
    sectionErrors
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
  const needsAssets = sectionSet.has('assets') || sectionSet.has('warranties');
  const needsReminders = sectionSet.has('reminders');
  const needsRepairs = sectionSet.has('repairs') || sectionSet.has('emergency_overview');
  const needsServiceRecords = sectionSet.has('service_records');
  const needsIssues = sectionSet.has('issues') || sectionSet.has('emergency_overview');
  const needsTrendFlags = sectionSet.has('trend_flags');
  const needsDocuments = sectionSet.has('documents_summary');
  const needsReceipts = sectionSet.has('receipts_summary');

  if (context.mode === 'demo') {
    const rooms = needsRooms ? getDemoRoomsWithFloors() : [];

    return {
      ...emptyReport,
      floors: needsRooms ? buildDemoFloors(context.property.id, rooms) : [],
      rooms,
      utilities: needsUtilities ? getDemoUtilities() : [],
      assets: needsAssets ? getDemoAssets() : [],
      reminders: needsReminders ? getDemoReminders() : [],
      repairs: needsRepairs ? getDemoRepairs() : [],
      serviceRecords: needsServiceRecords ? getDemoServiceRecords() : [],
      issues: needsIssues ? getDemoIssues() : [],
      trendFlags: needsTrendFlags ? getDemoTrendFlags() : [],
      documents: needsDocuments ? getDemoDocuments() : [],
      receipts: needsReceipts ? getDemoReceipts() : []
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

  return {
    ...emptyReport,
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
    receipts
  };
}
