import {
  HANDOVER_SECTION_LABELS,
  loadHandoverReport,
  type HandoverReportData,
  type HandoverSection
} from './handover';

export const SHARING_ROLES = [
  'owner',
  'co_owner',
  'editor',
  'viewer',
  'maintenance_guest',
  'buyer_preview',
  'insurance_view'
] as const;

export type SharingRole = (typeof SHARING_ROLES)[number];

export type SharingMode = 'demo' | 'supabase';

export type SharingPreview = {
  role: SharingRole;
  label: string;
  mode: SharingMode;
  propertyName: string | null;
  summary: string;
  visibleSections: string[];
  hiddenSections: string[];
  canSee: string[];
  cannotSee: string[];
  fileBehavior: string;
  receiptBehavior: string;
  financialDetailsBehavior: string;
  editBehavior: string;
  deleteBehavior: string;
  warning: string | null;
  receiptAmountsVisible: boolean;
  data: HandoverReportData;
};

type RoleProfile = {
  label: string;
  reportSections: HandoverSection[];
  visibleSections: string[];
  hiddenSections: string[];
  canSee: string[];
  cannotSee: string[];
  fileBehavior: string;
  receiptBehavior: string;
  financialDetailsBehavior: string;
  editBehavior: string;
  deleteBehavior: string;
  warning: string | null;
  receiptAmountsVisible: boolean;
  documentsVisible: boolean;
};

const BROAD_SAFE_SECTIONS: HandoverSection[] = [
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
];

const MAINTENANCE_SECTIONS: HandoverSection[] = [
  'property_summary',
  'utilities',
  'assets',
  'reminders',
  'repairs',
  'service_records',
  'issues',
  'emergency_overview'
];

const BUYER_SECTIONS: HandoverSection[] = [
  'property_summary',
  'rooms',
  'utilities',
  'assets',
  'warranties',
  'repairs',
  'service_records',
  'issues',
  'documents_summary'
];

const INSURANCE_SECTIONS: HandoverSection[] = [
  'property_summary',
  'assets',
  'warranties',
  'repairs',
  'service_records',
  'documents_summary',
  'receipts_summary'
];

const ROLE_PROFILES: Record<SharingRole, RoleProfile> = {
  owner: {
    label: 'Owner',
    reportSections: BROAD_SAFE_SECTIONS,
    visibleSections: [
      'All safe property data',
      'Rooms, utilities, assets, warranties, reminders, repairs, issues, and trend flags',
      'Document and receipt metadata',
      'Home Handover report printing'
    ],
    hiddenSections: ['Forbidden sensitive fields because they are not stored', 'Public file links because they do not exist'],
    canSee: ['Broad safe home records', 'Private metadata summaries', 'Receipt amounts in owner context'],
    cannotSee: ['Sensitive entry details, passwords, or public file links'],
    fileBehavior: 'Documents appear as metadata summaries only in this preview. No signed URLs are embedded.',
    receiptBehavior: 'Approved receipt metadata may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial metadata can be visible to the owner.',
    editBehavior: 'Owner can edit records under existing app permissions.',
    deleteBehavior: 'Owner can delete or soft-delete records where existing app permissions allow.',
    warning: null,
    receiptAmountsVisible: true,
    documentsVisible: true
  },
  co_owner: {
    label: 'Co-owner',
    reportSections: BROAD_SAFE_SECTIONS,
    visibleSections: [
      'Broad safe property data',
      'Rooms, utilities, assets, warranties, reminders, repairs, issues, and trend flags',
      'Document and receipt metadata'
    ],
    hiddenSections: ['Forbidden sensitive fields', 'Public file links', 'Future owner-only controls not implemented here'],
    canSee: ['Broad safe home records', 'Private metadata summaries', 'Receipt amounts in co-owner context'],
    cannotSee: ['Sensitive entry details, passwords, or public file links'],
    fileBehavior: 'Documents appear as metadata summaries only in this preview. No signed URLs are embedded.',
    receiptBehavior: 'Approved receipt metadata may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial metadata can be visible to co-owners.',
    editBehavior: 'Co-owner can edit records under existing app permissions.',
    deleteBehavior: 'Co-owner can delete or soft-delete records where existing app permissions allow.',
    warning: 'Future member-management rules may distinguish owner and co-owner behavior.',
    receiptAmountsVisible: true,
    documentsVisible: true
  },
  editor: {
    label: 'Editor',
    reportSections: BROAD_SAFE_SECTIONS,
    visibleSections: [
      'Broad safe property data',
      'Editable home records under existing RLS',
      'Document and receipt metadata'
    ],
    hiddenSections: ['Billing or ownership controls', 'Share links because they do not exist', 'Forbidden sensitive fields'],
    canSee: ['Broad safe home records', 'Private metadata summaries', 'Receipt amounts in editor context'],
    cannotSee: ['Billing controls', 'Ownership transfer controls', 'Share-link management'],
    fileBehavior: 'Documents appear as metadata summaries only in this preview. No signed URLs are embedded.',
    receiptBehavior: 'Approved receipt metadata may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial metadata can be visible to editors.',
    editBehavior: 'Editor can create and edit home records under existing app permissions.',
    deleteBehavior: 'Editor can delete or soft-delete records where existing app permissions allow.',
    warning: null,
    receiptAmountsVisible: true,
    documentsVisible: true
  },
  viewer: {
    label: 'Viewer',
    reportSections: BROAD_SAFE_SECTIONS,
    visibleSections: [
      'Read-only safe property data',
      'Rooms, utilities, assets, warranties, repairs, issues, and metadata summaries'
    ],
    hiddenSections: ['Create, edit, upload, delete, or sharing controls', 'Forbidden sensitive fields'],
    canSee: ['Safe read-only home records', 'Document metadata summaries', 'Approved receipt metadata'],
    cannotSee: ['Edit controls', 'Upload controls', 'Delete controls', 'Share-link controls'],
    fileBehavior: 'Documents appear as metadata summaries only in this preview. Viewing private files would remain governed by future role-specific rules.',
    receiptBehavior: 'Approved receipt metadata can be visible as read-only data.',
    financialDetailsBehavior: 'Financial metadata is shown here as broad read-only data; future sharing can make this more granular.',
    editBehavior: 'Viewer is read-only.',
    deleteBehavior: 'Viewer cannot delete records.',
    warning: null,
    receiptAmountsVisible: true,
    documentsVisible: true
  },
  maintenance_guest: {
    label: 'Maintenance guest',
    reportSections: MAINTENANCE_SECTIONS,
    visibleSections: [
      'Limited maintenance-relevant summaries',
      'Key utilities and shutoffs',
      'Relevant assets, reminders, repairs, service records, and issues'
    ],
    hiddenSections: [
      'Whole-home room archive',
      'Documents by default',
      'Receipt amounts',
      'Private notes',
      'Buyer or family handover archive'
    ],
    canSee: ['Conservative maintenance summaries', 'Critical utility names and safe location notes', 'Open repair and service context'],
    cannotSee: ['Whole-home access', 'Financial receipt amounts', 'Private notes', 'Documents by default', 'Public or signed file links'],
    fileBehavior: 'Documents are hidden by default for maintenance guests.',
    receiptBehavior: 'Receipts are hidden by default for maintenance guests.',
    financialDetailsBehavior: 'Financial details are hidden.',
    editBehavior: 'Maintenance guest edit behavior is not enabled in this phase.',
    deleteBehavior: 'Maintenance guest cannot delete records.',
    warning: 'Maintenance access must be scoped before real sharing is enabled.',
    receiptAmountsVisible: false,
    documentsVisible: false
  },
  buyer_preview: {
    label: 'Buyer preview',
    reportSections: BUYER_SECTIONS,
    visibleSections: [
      'Safe buyer handover summary',
      'Rooms, utilities, assets, warranties, repairs, service history, issues, and document metadata'
    ],
    hiddenSections: ['Private notes', 'Receipt financial details by default', 'Signed file links', 'Public share links'],
    canSee: ['Buyer-oriented safe summaries', 'Document metadata only', 'Issue status and severity without private notes'],
    cannotSee: ['Private notes', 'Receipt amounts by default', 'Signed file links', 'Share links'],
    fileBehavior: 'Documents appear as metadata summaries only. No signed URLs are embedded.',
    receiptBehavior: 'Receipt metadata is hidden by default in buyer preview unless a future handover setting explicitly includes it.',
    financialDetailsBehavior: 'Financial details are hidden by default.',
    editBehavior: 'Buyer preview is read-only.',
    deleteBehavior: 'Buyer preview cannot delete records.',
    warning: 'Buyer preview is a safe report concept only. No share link is created.',
    receiptAmountsVisible: false,
    documentsVisible: true
  },
  insurance_view: {
    label: 'Insurance view',
    reportSections: INSURANCE_SECTIONS,
    visibleSections: [
      'Property summary',
      'Assets and warranty summaries',
      'Receipts summary',
      'Documents summary',
      'Repairs and service records'
    ],
    hiddenSections: ['Public links', 'Signed file links', 'Guest access controls', 'Forbidden sensitive fields'],
    canSee: ['Insurance-relevant metadata summaries', 'Asset inventory', 'Approved receipt metadata', 'Document metadata'],
    cannotSee: ['Public file links', 'Signed file links', 'Invite credentials', 'Sensitive access details'],
    fileBehavior: 'Documents appear as metadata summaries only. No signed URLs are embedded.',
    receiptBehavior: 'Approved receipt metadata can be visible for insurance review.',
    financialDetailsBehavior: 'Receipt amounts may be visible for insurance context.',
    editBehavior: 'Insurance view is read-only in this planning phase.',
    deleteBehavior: 'Insurance view cannot delete records.',
    warning: 'Insurance view is a safe report concept only. No share link is created.',
    receiptAmountsVisible: true,
    documentsVisible: true
  }
};

function roleSummary(role: SharingRole) {
  switch (role) {
    case 'owner':
      return 'Full safe home-data access for the property owner. Real member management is not added in this phase.';
    case 'co_owner':
      return 'Broad safe home-data access similar to owner, with future member-management differences deferred.';
    case 'editor':
      return 'Create and edit safe home records, without ownership, billing, or share-link management.';
    case 'viewer':
      return 'Read-only safe home-data access. No creation, editing, uploading, or deletion.';
    case 'maintenance_guest':
      return 'Highly restricted maintenance-oriented preview. Real maintenance access must be scoped before enablement.';
    case 'buyer_preview':
      return 'Buyer-safe report preview concept. This is not a share link or guest account.';
    case 'insurance_view':
      return 'Insurance-oriented metadata preview concept. This is not a share link or guest account.';
  }
}

function hideDocuments(data: HandoverReportData) {
  return {
    ...data,
    documents: []
  };
}

function hideReceipts(data: HandoverReportData) {
  return {
    ...data,
    receipts: []
  };
}

function containsSensitivePreviewText(value: string | null | undefined) {
  if (!value) return false;

  return [
    /access\s*codes?/i,
    /lock\s*codes?/i,
    /garage\s*codes?/i,
    /safe\s*codes?/i,
    /alarm\s*codes?/i,
    /wi[-\s]?fi\s*passwords?/i,
    /wifi\s*passwords?/i,
    /hidden\s*keys?/i,
    /door\s*codes?/i,
    /keypad\s*codes?/i,
    /^https?:\/\//i,
    /^www\./i
  ].some((pattern) => pattern.test(value));
}

function scrubRequiredText(value: string, fallback: string) {
  return containsSensitivePreviewText(value) ? fallback : value;
}

function scrubOptionalText(value: string | null | undefined) {
  if (!value) return null;
  return containsSensitivePreviewText(value) ? null : value;
}

function sanitizeDocuments(data: HandoverReportData): HandoverReportData {
  return {
    ...data,
    documents: data.documents.map((document) => ({
      ...document,
      title: scrubRequiredText(document.title, 'Document'),
      description: null,
      file_name: scrubRequiredText(document.file_name, 'document'),
      file_path: ''
    }))
  };
}

function sanitizePreviewText(data: HandoverReportData): HandoverReportData {
  return sanitizeDocuments({
    ...data,
    floors: data.floors.map((floor) => ({
      ...floor,
      name: scrubRequiredText(floor.name, 'Floor')
    })),
    rooms: data.rooms.map((room) => ({
      ...room,
      name: scrubRequiredText(room.name, 'Room'),
      floor_name: scrubRequiredText(room.floor_name, 'Unassigned')
    })),
    utilities: data.utilities.map((utility) => ({
      ...utility,
      name: scrubRequiredText(utility.name, 'Utility'),
      location_notes: scrubOptionalText(utility.location_notes),
      emergency_notes: scrubOptionalText(utility.emergency_notes)
    })),
    assets: data.assets.map((asset) => ({
      ...asset,
      name: scrubRequiredText(asset.name, 'Asset'),
      brand: scrubOptionalText(asset.brand),
      model: scrubOptionalText(asset.model),
      serial_number: scrubOptionalText(asset.serial_number),
      retailer: scrubOptionalText(asset.retailer),
      manual_url: null,
      support_url: null,
      notes: scrubOptionalText(asset.notes)
    })),
    reminders: data.reminders.map((reminder) => ({
      ...reminder,
      title: scrubRequiredText(reminder.title, 'Reminder'),
      description: scrubOptionalText(reminder.description),
      repeat_rule: null
    })),
    repairs: data.repairs.map((repair) => ({
      ...repair,
      title: scrubRequiredText(repair.title, 'Repair'),
      description: scrubOptionalText(repair.description),
      contractor_name: scrubOptionalText(repair.contractor_name),
      contractor_phone: scrubOptionalText(repair.contractor_phone),
      contractor_email: scrubOptionalText(repair.contractor_email),
      notes: scrubOptionalText(repair.notes)
    })),
    serviceRecords: data.serviceRecords.map((record) => ({
      ...record,
      service_title: scrubRequiredText(record.service_title, 'Service record'),
      provider_name: scrubOptionalText(record.provider_name),
      provider_phone: scrubOptionalText(record.provider_phone),
      provider_email: scrubOptionalText(record.provider_email),
      summary: scrubOptionalText(record.summary),
      notes: scrubOptionalText(record.notes),
      title: scrubRequiredText(record.title, 'Service record'),
      description: scrubOptionalText(record.description),
      vendor_name: scrubOptionalText(record.vendor_name),
      vendor_phone: scrubOptionalText(record.vendor_phone),
      vendor_email: scrubOptionalText(record.vendor_email)
    })),
    issues: data.issues.map((issue) => ({
      ...issue,
      title: scrubRequiredText(issue.title, 'Issue'),
      description: scrubOptionalText(issue.description),
      notes: scrubOptionalText(issue.notes)
    })),
    trendFlags: data.trendFlags.map((flag) => ({
      ...flag,
      title: scrubRequiredText(flag.title, 'Trend flag'),
      description: scrubOptionalText(flag.description)
    })),
    receipts: data.receipts.map((receipt) => ({
      ...receipt,
      vendor_name: scrubOptionalText(receipt.vendor_name),
      payment_method: scrubOptionalText(receipt.payment_method),
      description: scrubOptionalText(receipt.description),
      notes: scrubOptionalText(receipt.notes)
    }))
  });
}

function stripPrivateDetails(data: HandoverReportData): HandoverReportData {
  return {
    ...data,
    assets: data.assets.map((asset) => ({
      ...asset,
      purchase_price: null,
      serial_number: null,
      retailer: null,
      notes: null
    })),
    reminders: data.reminders.map((reminder) => ({
      ...reminder,
      description: null,
      repeat_rule: null
    })),
    repairs: data.repairs.map((repair) => ({
      ...repair,
      description: null,
      estimated_cost: null,
      actual_cost: null,
      contractor_phone: null,
      contractor_email: null,
      notes: null
    })),
    serviceRecords: data.serviceRecords.map((record) => ({
      ...record,
      provider_phone: null,
      provider_email: null,
      cost: null,
      summary: null,
      notes: null,
      description: null,
      vendor_phone: null,
      vendor_email: null
    })),
    issues: data.issues.map((issue) => ({
      ...issue,
      description: null,
      notes: null
    })),
    trendFlags: data.trendFlags.map((flag) => ({
      ...flag,
      description: null
    })),
    receipts: data.receipts.map((receipt) => ({
      ...receipt,
      total_amount: null,
      tax_amount: null,
      payment_method: null,
      notes: null
    }))
  };
}

function restrictMaintenanceData(data: HandoverReportData): HandoverReportData {
  return {
    ...data,
    rooms: [],
    floors: [],
    trendFlags: [],
    documents: [],
    receipts: [],
    repairs: data.repairs.filter((repair) => repair.status !== 'completed' && repair.status !== 'cancelled').slice(0, 8),
    reminders: data.reminders.filter((reminder) => reminder.status === 'open').slice(0, 8),
    issues: data.issues.filter((issue) => issue.status !== 'resolved' && issue.status !== 'dismissed').slice(0, 8),
    serviceRecords: data.serviceRecords.slice(0, 8),
    utilities: data.utilities.slice(0, 8),
    assets: data.assets.slice(0, 8)
  };
}

function applyRoleFilters(role: SharingRole, data: HandoverReportData): HandoverReportData {
  const sanitizedData = sanitizePreviewText(data);

  if (role === 'maintenance_guest') {
    return stripPrivateDetails(restrictMaintenanceData(sanitizedData));
  }

  if (role === 'buyer_preview') {
    return hideReceipts(stripPrivateDetails(sanitizedData));
  }

  const profile = ROLE_PROFILES[role];
  if (!profile.documentsVisible) {
    return hideDocuments(sanitizedData);
  }

  return sanitizedData;
}

export function getSharingRoleProfile(role: SharingRole) {
  return ROLE_PROFILES[role];
}

export async function loadSharingPreview(role: SharingRole): Promise<SharingPreview> {
  const profile = ROLE_PROFILES[role];
  const loaded = await loadHandoverReport({
    reportType: role === 'insurance_view' ? 'insurance' : role === 'buyer_preview' ? 'buyer' : 'personal_archive',
    sections: profile.reportSections
  });
  const data = applyRoleFilters(role, loaded);

  return {
    role,
    label: profile.label,
    mode: loaded.context.mode,
    propertyName: loaded.context.property?.nickname || null,
    summary: roleSummary(role),
    visibleSections: profile.visibleSections,
    hiddenSections: profile.hiddenSections,
    canSee: profile.canSee,
    cannotSee: profile.cannotSee,
    fileBehavior: profile.fileBehavior,
    receiptBehavior: profile.receiptBehavior,
    financialDetailsBehavior: profile.financialDetailsBehavior,
    editBehavior: profile.editBehavior,
    deleteBehavior: profile.deleteBehavior,
    warning: profile.warning,
    receiptAmountsVisible: profile.receiptAmountsVisible,
    data: {
      ...data,
      sections: profile.reportSections.filter((section) => {
        if (!profile.documentsVisible && section === 'documents_summary') return false;
        if (role === 'buyer_preview' && section === 'receipts_summary') return false;
        return true;
      })
    }
  };
}

export function sharingSectionLabel(section: HandoverSection) {
  return HANDOVER_SECTION_LABELS[section];
}
