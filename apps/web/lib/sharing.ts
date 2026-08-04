import {
  getHandoverContext,
  HANDOVER_SECTION_LABELS,
  loadHandoverReport,
  type HandoverReportData,
  type HandoverSection
} from './handover';
import { getSupabaseSetupMessage } from './auth';
import { getSupabaseBrowserClient } from './supabase/client';
import { formatDataError } from './errors';

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

export type InvitationRole = Exclude<SharingRole, 'owner'>;

export type PropertyInvitation = {
  id: string;
  property_id: string;
  inviter_user_id: string;
  invited_email: string | null;
  role: InvitationRole;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreatedPropertyInvitation = {
  invitation: PropertyInvitation | null;
  inviteToken: string;
  inviteUrl: string;
  expiresAt: string;
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
      'Rooms, utilities, assets, warranties, reminders, repairs, issues, and trends',
      'File and receipt details',
      'Home Handover report printing'
    ],
    hiddenSections: ['Forbidden sensitive fields because they are not stored', 'Public file links because they do not exist'],
    canSee: ['Broad safe home records', 'Private file summaries', 'Receipt amounts in owner context'],
    cannotSee: ['Sensitive entry details, passwords, or public file links'],
    fileBehavior: 'Documents appear as file details only in this preview. No public link is created.',
    receiptBehavior: 'Approved receipt details may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial details can be visible to the owner.',
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
      'Rooms, utilities, assets, warranties, reminders, repairs, issues, and trends',
      'File and receipt details'
    ],
    hiddenSections: ['Forbidden sensitive fields', 'Public file links', 'Future owner-only controls not implemented here'],
    canSee: ['Broad safe home records', 'Private file summaries', 'Receipt amounts in co-owner context'],
    cannotSee: ['Sensitive entry details, passwords, or public file links'],
    fileBehavior: 'Documents appear as file details only in this preview. No public link is created.',
    receiptBehavior: 'Approved receipt details may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial details can be visible to co-owners.',
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
      'File and receipt details'
    ],
    hiddenSections: ['Billing or ownership controls', 'Share links because they do not exist', 'Forbidden sensitive fields'],
    canSee: ['Broad safe home records', 'Private file summaries', 'Receipt amounts in editor context'],
    cannotSee: ['Billing controls', 'Ownership transfer controls', 'Share-link management'],
    fileBehavior: 'Documents appear as file details only in this preview. No public link is created.',
    receiptBehavior: 'Approved receipt details may be shown, including amounts.',
    financialDetailsBehavior: 'Safe financial details can be visible to editors.',
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
      'Rooms, utilities, assets, warranties, repairs, issues, and file details'
    ],
    hiddenSections: ['Create, edit, upload, delete, or sharing controls', 'Forbidden sensitive fields'],
    canSee: ['Safe read-only home records', 'File details', 'Approved receipt details'],
    cannotSee: ['Edit controls', 'Upload controls', 'Delete controls', 'Share-link controls'],
    fileBehavior: 'Documents appear as file details only in this preview. Viewing private files would remain governed by future role-specific rules.',
    receiptBehavior: 'Approved receipt details can be visible as read-only data.',
    financialDetailsBehavior: 'Financial details are shown here as broad read-only data; future sharing can make this more granular.',
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
      'Relevant assets, reminders, repairs, service history, and issues'
    ],
    hiddenSections: [
      'Whole-home room archive',
      'Documents by default',
      'Receipt amounts',
      'Private notes',
      'Buyer or family handover archive'
    ],
    canSee: ['Conservative maintenance summaries', 'Critical utility names and safe location notes', 'Open repair and service context'],
    cannotSee: ['Whole-home access', 'Financial receipt amounts', 'Private notes', 'Documents by default', 'Public file links'],
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
      'Rooms, utilities, assets, warranties, repairs, service history, issues, and file details'
    ],
    hiddenSections: ['Private notes', 'Receipt financial details by default', 'Private file access', 'Public share links'],
    canSee: ['Buyer-oriented safe summaries', 'File details only', 'Issue status and severity without private notes'],
    cannotSee: ['Private notes', 'Receipt amounts by default', 'Private file access', 'Share links'],
    fileBehavior: 'Documents appear as file details only. No public link is created.',
    receiptBehavior: 'Receipt details are hidden by default in buyer preview unless a future handover setting explicitly includes them.',
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
      'Repairs and service history'
    ],
    hiddenSections: ['Public links', 'Private file access', 'Guest access controls', 'Forbidden sensitive fields'],
    canSee: ['Insurance-relevant summaries', 'Asset inventory', 'Approved receipt details', 'File details'],
    cannotSee: ['Public file links', 'Private file access', 'Invite credentials', 'Sensitive access details'],
    fileBehavior: 'Documents appear as file details only. No public link is created.',
    receiptBehavior: 'Approved receipt details can be visible for insurance review.',
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
      return 'Insurance-oriented file detail preview concept. This is not a share link or guest account.';
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

function normalizeInvitation(raw: Partial<PropertyInvitation>): PropertyInvitation {
  const createdAt = raw.created_at || new Date().toISOString();

  return {
    id: raw.id || '',
    property_id: raw.property_id || '',
    inviter_user_id: raw.inviter_user_id || '',
    invited_email: raw.invited_email || null,
    role: (raw.role || 'viewer') as InvitationRole,
    expires_at: raw.expires_at || createdAt,
    accepted_at: raw.accepted_at || null,
    accepted_by: raw.accepted_by || null,
    revoked_at: raw.revoked_at || null,
    created_at: createdAt,
    updated_at: raw.updated_at || createdAt,
    deleted_at: raw.deleted_at || null
  };
}

function buildInviteUrl(inviteToken: string) {
  const path = `/accept-invite?token=${encodeURIComponent(inviteToken)}`;
  if (typeof window === 'undefined') {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export async function listPropertyInvitations() {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property) {
    return [] as PropertyInvitation[];
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('property_invitations')
    .select('id, property_id, inviter_user_id, invited_email, role, expires_at, accepted_at, accepted_by, revoked_at, created_at, updated_at, deleted_at')
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDataError('load invitations', error.message || ''));
  }

  return ((data ?? []) as Partial<PropertyInvitation>[]).map(normalizeInvitation);
}

export async function createPropertyInvitation(input: {
  role: InvitationRole;
  invitedEmail?: string | null;
  expiresInSeconds?: number;
}): Promise<CreatedPropertyInvitation> {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property) {
    throw new Error('Sign in and create a property before inviting someone.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase.rpc('create_property_invitation', {
    target_property_id: context.property.id,
    target_invited_email: input.invitedEmail || null,
    target_role: input.role,
    target_expires_in_seconds: input.expiresInSeconds ?? 604800
  });

  if (error) {
    throw new Error(formatDataError('create an invitation', error.message || ''));
  }

  const result = Array.isArray(data) ? data[0] : data;
  const inviteToken = String(result?.invite_token || '');
  if (!inviteToken) {
    throw new Error('Invitation was created without a token.');
  }

  const invitations = await listPropertyInvitations();
  const invitation =
    invitations.find((item) => item.id === result?.invitation_id) || invitations[0] || null;

  return {
    invitation,
    inviteToken,
    inviteUrl: buildInviteUrl(inviteToken),
    expiresAt: String(result?.expires_at || invitation?.expires_at || '')
  };
}

// ---------------------------------------------------------------------------
// ZERO-ROW WRITES ARE FAILURES HERE
//
// PostgREST reports success when an UPDATE or DELETE matches nothing — RLS
// filtering and guarded WHERE clauses both look identical to "done". On this
// page that silence is an access-control lie: Jesse revoked a viewer from a
// stale invitation list, the guarded update matched zero rows, the UI said
// "Invitation revoked.", and the viewer kept reading the house. Every write
// below now asks for the affected rows back and treats an empty result as an
// error with a message that says what actually happened.
// ---------------------------------------------------------------------------

/** Why a guarded invitation revoke matched zero rows, given what the
 * invitation looks like when re-read. Pure, so it is testable. */
export function describeInvitationRevokeMiss(invitation: Pick<
  PropertyInvitation,
  'accepted_at' | 'revoked_at' | 'invited_email'
> | null): string {
  if (!invitation) {
    return 'This invitation no longer exists. Refresh the page to see the current list.';
  }

  if (invitation.accepted_at) {
    const who = invitation.invited_email || 'the person who accepted it';
    return `This invitation was already accepted, so revoking it changes nothing — ${who} already has access. Remove them under “People with access” to take that access away.`;
  }

  if (invitation.revoked_at) {
    return 'This invitation was already revoked. Refresh the page to see the current list.';
  }

  return 'This invitation could not be revoked — it may have changed since this page loaded. Refresh and try again.';
}

export async function revokePropertyInvitation(invitationId: string) {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property) {
    throw new Error('Sign in and create a property before revoking invitations.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('property_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('property_id', context.property.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    throw new Error(formatDataError('withdraw this invitation', error.message || ''));
  }

  if (!data || data.length === 0) {
    // The guarded update matched nothing. Re-read the invitation so the
    // message states what is true now, not what this page believed.
    let invitation: PropertyInvitation | null = null;
    try {
      const invitations = await listPropertyInvitations();
      invitation = invitations.find((item) => item.id === invitationId) || null;
    } catch {
      // If the re-read fails we still refuse to claim success.
    }
    throw new Error(describeInvitationRevokeMiss(invitation));
  }
}

// ---------------------------------------------------------------------------
// PEOPLE WITH ACCESS
//
// Members are governed by two independent server-side rules, and this module
// only ever mirrors them — it never substitutes for them:
//   * RLS (`can_manage_property_members`) — owners and co-owners may update or
//     remove member rows at all.
//   * The `guard_property_member_role` trigger (migration 015) — only a true
//     owner may grant, downgrade, or remove owner/co-owner access, and a
//     membership's identity (property_id, user_id) can never be changed.
// The UI reads the caller's own role first so it never offers a control that
// the database is certain to reject.
// ---------------------------------------------------------------------------

/** Roles this screen can hand out. `owner` is deliberately absent: ownership
 * moves through the transfer flow (properties.owner_user_id), not by editing a
 * membership row. */
export const ASSIGNABLE_MEMBER_ROLES = SHARING_ROLES.filter(
  (role): role is Exclude<SharingRole, 'owner'> => role !== 'owner'
);

export type PropertyMember = {
  id: string;
  user_id: string;
  role: SharingRole;
  created_at: string;
  /** Email from the invitation they accepted, when we have one. Profiles are
   * self-select only under RLS, so another person's name is not readable. */
  label: string;
  isYou: boolean;
  /** True for the account in properties.owner_user_id — never editable here. */
  isPropertyOwner: boolean;
};

export type PropertyMemberAccess = {
  mode: SharingMode;
  propertyName: string | null;
  /** The caller's own role on this property, straight from the database. */
  role: SharingRole | null;
  canManage: boolean;
  /** True only for a real owner — the trigger's test for owner/co-owner edits. */
  isOwner: boolean;
  members: PropertyMember[];
};

const EMPTY_MEMBER_ACCESS: PropertyMemberAccess = {
  mode: 'demo',
  propertyName: null,
  role: null,
  canManage: false,
  isOwner: false,
  members: []
};

/** The caller's role as the database itself computes it (migration 015). */
export async function getCurrentPropertyRole(propertyId: string): Promise<SharingRole | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase.rpc('current_property_role', {
    target_property_id: propertyId
  });

  if (error) {
    throw new Error(formatDataError('check your access level', error.message || ''));
  }

  const role = typeof data === 'string' ? data : null;
  return role && (SHARING_ROLES as readonly string[]).includes(role) ? (role as SharingRole) : null;
}

/**
 * Everyone who currently has access, plus what the caller is allowed to do
 * about it. Returns an empty, permission-free result in demo mode or when the
 * caller cannot manage members, so the page simply has nothing to show.
 */
export async function listPropertyMembers(): Promise<PropertyMemberAccess> {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property || !context.user) {
    return EMPTY_MEMBER_ACCESS;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const property = context.property;
  const role = await getCurrentPropertyRole(property.id);
  const canManage = role === 'owner' || role === 'co_owner';
  const isOwner = role === 'owner';

  const base: PropertyMemberAccess = {
    mode: 'supabase',
    propertyName: property.nickname || null,
    role,
    canManage,
    isOwner,
    members: []
  };

  if (!canManage) {
    return base;
  }

  const { data, error } = await supabase
    .from('property_members')
    .select('id, user_id, role, created_at')
    .eq('property_id', property.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(formatDataError('load the people with access', error.message || ''));
  }

  // Names live in `profiles`, which every account can read only for itself, so
  // the honest label for someone else is the address they were invited at.
  let emailByUserId = new Map<string, string>();
  try {
    const invitations = await listPropertyInvitations();
    emailByUserId = new Map(
      invitations
        .filter((invitation) => invitation.accepted_by && invitation.invited_email)
        .map((invitation) => [invitation.accepted_by as string, invitation.invited_email as string])
    );
  } catch {
    // Labels are a nicety; never block the list on them.
  }

  const rows = (data ?? []) as Array<{ id: string; user_id: string; role: string; created_at: string }>;
  const members: PropertyMember[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    role: ((SHARING_ROLES as readonly string[]).includes(row.role) ? row.role : 'viewer') as SharingRole,
    created_at: row.created_at,
    label:
      row.user_id === context.user?.id
        ? context.user?.email || 'You'
        : emailByUserId.get(row.user_id) || 'Someone you invited',
    isYou: row.user_id === context.user?.id,
    isPropertyOwner: row.user_id === property.owner_user_id
  }));

  // The account in properties.owner_user_id may hold no membership row at all.
  // Show it anyway, so "people with access" is never quietly missing the owner.
  if (!members.some((member) => member.user_id === property.owner_user_id)) {
    members.unshift({
      id: `owner:${property.owner_user_id}`,
      user_id: property.owner_user_id,
      role: 'owner',
      created_at: property.created_at,
      label: property.owner_user_id === context.user.id ? context.user.email || 'You' : 'The owner',
      isYou: property.owner_user_id === context.user.id,
      isPropertyOwner: true
    });
  }

  return { ...base, members };
}

/** True when the caller may change this member's role at all. Mirrors the
 * trigger: owner/co-owner rows are owner-only, and the property owner's own
 * access is never edited from here. */
export function canEditMember(access: PropertyMemberAccess, member: PropertyMember) {
  if (!access.canManage || member.isPropertyOwner) {
    return false;
  }

  if (member.role === 'owner' || member.role === 'co_owner') {
    return access.isOwner;
  }

  return true;
}

/** Roles the caller can actually assign — a co-owner cannot create another
 * owner or co-owner, so those options are not offered. */
export function assignableRolesFor(access: PropertyMemberAccess) {
  return ASSIGNABLE_MEMBER_ROLES.filter((role) => (role === 'co_owner' ? access.isOwner : true));
}

export async function updatePropertyMemberRole(memberId: string, role: SharingRole) {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property) {
    throw new Error('Sign in and create a property before changing access.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  // Only the role moves. property_id and user_id are immutable by trigger, and
  // sending them would be rejected rather than ignored.
  const { data, error } = await supabase
    .from('property_members')
    .update({ role })
    .eq('id', memberId)
    .eq('property_id', context.property.id)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    throw new Error(formatDataError('change this person’s access', error.message || ''));
  }

  if (!data || data.length === 0) {
    throw new Error(
      'This person’s access was not changed — their membership may have changed since this page loaded. Refresh and try again.'
    );
  }
}

export async function removePropertyMember(memberId: string) {
  const context = await getHandoverContext();
  if (context.mode === 'demo' || !context.property) {
    throw new Error('Sign in and create a property before changing access.');
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase
    .from('property_members')
    .delete()
    .eq('id', memberId)
    .eq('property_id', context.property.id)
    .select('id');

  if (error) {
    throw new Error(formatDataError('remove this person', error.message || ''));
  }

  if (!data || data.length === 0) {
    throw new Error(
      'This person was not removed — they still have access. Their membership may have changed since this page loaded; refresh and try again.'
    );
  }
}

export async function acceptPropertyInvitation(inviteToken: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase.rpc('accept_property_invitation', {
    invite_token: inviteToken
  });

  if (error) {
    throw new Error(formatDataError('accept this invitation', error.message || ''));
  }

  return String(data);
}

// --- Invitations waiting for the signed-in address ---------------------------
//
// The token lives only in the emailed link, so anything that interrupted the
// trip from that link to the Accept button stranded the recipient with no way
// back. These two read and accept by invitation id instead, which is safe
// because the database requires the invited address to match the caller
// (migration 040) — and because open invitations, which have no address, are
// deliberately invisible here.

export type PendingInvitation = {
  invitation_id: string;
  property_id: string;
  property_nickname: string | null;
  role: string;
  expires_at: string;
};

export async function listPendingInvitationsForMe(): Promise<PendingInvitation[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('list_pending_invitations_for_me');
  if (error) {
    // A convenience surface must never break the dashboard it sits on.
    return [];
  }

  return (data ?? []) as PendingInvitation[];
}

export async function acceptPendingInvitation(invitationId: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error(getSupabaseSetupMessage());
  }

  const { data, error } = await supabase.rpc('accept_pending_invitation', {
    p_invitation_id: invitationId
  });

  if (error) {
    throw new Error(formatDataError('accept this invitation', error.message || ''));
  }

  return String(data);
}
