import { z } from 'zod';

export const PROPERTY_TYPES = [
  'single_family_home',
  'condo',
  'apartment',
  'townhome',
  'duplex',
  'cabin',
  'rental_home',
  'apartment_building',
  'multi_family'
] as const;

export const ROOM_TYPES = [
  'bedroom',
  'bathroom',
  'kitchen',
  'living_room',
  'dining_room',
  'office',
  'laundry_room',
  'garage',
  'basement',
  'attic',
  'crawl_space',
  'utility_room',
  'closet',
  'hallway',
  'entryway',
  'exterior',
  'yard',
  'shed',
  'patio',
  'deck',
  'other'
] as const;

export const UTILITY_TYPES = [
  'main_water_shutoff',
  'electrical_panel',
  'gas_shutoff',
  'water_heater',
  'hvac_unit',
  'furnace',
  'air_conditioner',
  'breaker_panel',
  'sump_pump',
  'irrigation_shutoff',
  'internet_modem',
  'router',
  'smoke_detector',
  'carbon_monoxide_detector',
  'other'
] as const;

export const ASSET_TYPES = [
  'appliance',
  'accessory',
  'smart_device',
  'tool',
  'fixture',
  'furniture',
  'electronics',
  'outdoor_equipment',
  'home_system_component',
  'other'
] as const;

export const VISIBILITY_OPTIONS = [
  'private',
  'family',
  'maintenance',
  'buyer_report'
] as const;

export const VISIBILITY_CONTEXTS = [
  'family',
  'buyer',
  'maintenance',
  'insurance',
  'personal_archive'
] as const;

export const WARRANTY_STATUSES = [
  'active',
  'expiring_soon',
  'expired',
  'unknown'
] as const;

export const REMINDER_TYPES = [
  'general',
  'maintenance',
  'warranty',
  'filter_change',
  'inspection',
  'seasonal',
  'utility',
  'asset',
  'other'
] as const;

export const REMINDER_LINKED_TYPES = [
  'property',
  'room',
  'utility',
  'asset'
] as const;

export const REMINDER_STATUSES = [
  'open',
  'completed',
  'dismissed'
] as const;

export const REMINDER_FREQUENCIES = [
  'none',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom'
] as const;

export const REMINDER_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent'
] as const;

export const REMINDER_SOURCES = [
  'manual',
  'warranty',
  'asset',
  'utility',
  'system_suggestion'
] as const;

export const REPAIR_TYPES = [
  'general',
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'roof',
  'exterior',
  'interior',
  'smart_home',
  'utility',
  'other'
] as const;

export const REPAIR_STATUSES = [
  'open',
  'scheduled',
  'in_progress',
  'completed',
  'deferred',
  'cancelled'
] as const;

export const REPAIR_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent'
] as const;

export const SERVICE_TYPES = [
  'maintenance',
  'repair',
  'inspection',
  'installation',
  'replacement',
  'cleaning',
  'tune_up',
  'warranty_service',
  'other'
] as const;

export const ISSUE_TYPES = [
  'general',
  'water_leak',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'roof',
  'mold',
  'pest',
  'safety',
  'utility',
  'smart_home',
  'cosmetic',
  'other'
] as const;

export const ISSUE_STATUSES = [
  'open',
  'monitoring',
  'scheduled',
  'in_progress',
  'resolved',
  'dismissed'
] as const;

export const ISSUE_SEVERITIES = [
  'low',
  'medium',
  'high',
  'urgent'
] as const;

export const TREND_FLAG_TYPES = [
  'repeat_issue',
  'recurring_repair',
  'rising_cost',
  'maintenance_overdue',
  'warranty_risk',
  'safety_pattern',
  'water_risk',
  'hvac_pattern',
  'electrical_pattern',
  'manual_flag',
  'other'
] as const;

export const TREND_FLAG_STATUSES = [
  'active',
  'monitoring',
  'resolved',
  'dismissed'
] as const;

export const TREND_FLAG_DETECTED_FROM = [
  'manual',
  'issue_history',
  'repair_history',
  'service_history',
  'reminder_history',
  'system_suggestion'
] as const;

export const DOCUMENT_TYPES = [
  'manual',
  'warranty',
  'receipt',
  'invoice',
  'quote',
  'inspection_report',
  'service_report',
  'permit',
  'photo',
  'insurance',
  'property_document',
  'utility_document',
  'asset_document',
  'repair_document',
  'issue_document',
  'other',
  'condition_photo',
  'compliance_certificate',
  'tenancy_document'
] as const;

export const DOCUMENT_VISIBILITIES = [
  'private',
  'family',
  'maintenance',
  'buyer_report'
] as const;

export const DOCUMENT_SOURCES = [
  'manual_upload',
  'future_receipt_upload',
  'future_ai_import',
  'system'
] as const;

export const RECEIPT_CATEGORIES = [
  'appliance',
  'tool',
  'utility',
  'repair',
  'maintenance',
  'warranty',
  'home_improvement',
  'furniture',
  'electronics',
  'supplies',
  'inspection',
  'permit',
  'insurance',
  'other'
] as const;

export const RECEIPT_APPROVAL_STATUSES = [
  'draft',
  'needs_review',
  'approved',
  'rejected'
] as const;

export const RECEIPT_SOURCES = [
  'manual_entry',
  'manual_review',
  'future_ai_parse',
  'future_ocr_parse'
] as const;

export const MEMBER_ROLES = [
  'owner',
  'co_owner',
  'editor',
  'viewer',
  'maintenance_guest',
  'buyer_preview',
  'insurance_view'
] as const;

export const PLAN_NAMES = [
  'free',
  'paid',
  'extra_property'
] as const;

/**
 * Only same-origin, in-app destinations may be used as a post-auth redirect.
 *
 * Next.js hands any scheme-bearing value to a hard `window.location` assignment
 * with no scheme filter, so an unvalidated `?next=` is both an open redirect
 * and a `javascript:` sink. A protocol-relative `//host` is rejected too — the
 * browser reads it as another origin.
 */
export function safeRelativePath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  // Must start with a single slash, and carry no scheme, no authority, and no
  // backslash (which some browsers normalise to '/').
  if (!/^\/(?!\/)/.test(trimmed) || trimmed.includes('\\') || trimmed.includes(':')) {
    return fallback;
  }

  // Control characters can be used to smuggle a scheme past the checks above.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const optionalHttpUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, context) => {
    if (value === null || value === undefined || value.trim() === '') {
      return null;
    }

    const safeUrl = safeHttpUrl(value);
    if (!safeUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use a valid http:// or https:// URL.'
      });
      return z.NEVER;
    }

    return safeUrl;
  });

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a date-only string ("2026-07-30") as local midnight.
 *
 * `new Date('2026-07-30')` is interpreted as UTC midnight, so anywhere west of
 * UTC it renders as the previous day — which put every date on the printed
 * handover report one day early for a US reader. Values that already carry a
 * time component are passed through to the normal Date parser.
 */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Human-readable calendar date with no timezone drift. */
export function formatCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string | null {
  const parsed = parseCalendarDate(value);
  return parsed ? parsed.toLocaleDateString(undefined, options) : null;
}

export type WarrantyLike = {
  warranty_expires_at?: string | null;
  purchase_date?: string | null;
  warranty_length_months?: number | null;
};

export function getWarrantyMeta(asset: WarrantyLike): {
  status: WarrantyStatus;
  daysRemaining: number | null;
  expirationDate: string | null;
} {
  let expirationDate = asset.warranty_expires_at || null;

  if (!expirationDate && asset.purchase_date && asset.warranty_length_months) {
    const purchaseDate = new Date(`${asset.purchase_date}T00:00:00`);
    if (!Number.isNaN(purchaseDate.getTime())) {
      purchaseDate.setMonth(purchaseDate.getMonth() + asset.warranty_length_months);
      expirationDate = toLocalDateString(purchaseDate);
    }
  }

  if (!expirationDate) {
    return { status: 'unknown', daysRemaining: null, expirationDate: null };
  }

  const expiration = new Date(`${expirationDate}T00:00:00`);
  if (Number.isNaN(expiration.getTime())) {
    return { status: 'unknown', daysRemaining: null, expirationDate };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((expiration.getTime() - today.getTime()) / 86_400_000);

  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining, expirationDate };
  }

  if (daysRemaining <= 30) {
    return { status: 'expiring_soon', daysRemaining, expirationDate };
  }

  return { status: 'active', daysRemaining, expirationDate };
}

export const forbiddenSensitivePatterns = [
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
  // broadened: common secret phrasings and "code/pin: 1234" style entries
  /pass\s*codes?/i,
  /pass\s*words?/i,
  // "pin" and "combination" on their own are ordinary home vocabulary — a
  // combination boiler, a cotter pin, hinge pins. Matching them bare blanked
  // real shut-off notes out of the sheet a homeowner hands to a technician.
  // Require the secret-bearing sense instead; the digit-proximity rule below
  // still catches "combination 1234" and "pin 4417".
  /\bpin\s*(?:codes?|numbers?|#)/i,
  /combination\s*(?:locks?|codes?|numbers?)/i,
  /\bcodes?\b\s*[:#=-]/i,
  // Digits near a secret word. Two or more digits with optional separators, so
  // hyphenated forms like a safe's "12-24-6" are caught as well as "4729" —
  // requiring three *consecutive* digits missed them.
  /\b(code|pin|combo|combination)\b[^.\n]{0,12}\d(?:[\s._-]*\d)+/i
] as const;

/**
 * Whether this text would be withheld from a shared sheet or handover report.
 *
 * Exposed so a form can say so while the user is typing, instead of the text
 * silently becoming "Hidden by privacy rule" on a document they have already
 * handed to a technician.
 */
export function containsSensitiveText(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return false;
  }

  return forbiddenSensitivePatterns.some((pattern) => pattern.test(value));
}

/**
 * Redaction is deliberately whole-field, not span-level: these patterns match
 * the *label* ("garage code"), and the secret usually sits right beside it, so
 * blanking only the matched words would leave "… is 1234" in plain sight.
 */
export function safeText(value: string | null | undefined, fallback = 'Hidden by privacy rule') {
  if (!value || !value.trim()) {
    return null;
  }

  return containsSensitiveText(value) ? fallback : value.trim();
}

export function safeFileName(value: string | null | undefined) {
  const fileName = safeText(value);
  if (!fileName || /^https?:\/\//i.test(fileName) || /^www\./i.test(fileName)) {
    return null;
  }

  return fileName;
}

export const createPropertySchema = z.object({
  nickname: z.string().min(1, 'Property nickname is required'),
  property_type: z.enum(PROPERTY_TYPES),
  address_line_1: z.string().max(10000).optional().nullable(),
  address_line_2: z.string().max(10000).optional().nullable(),
  city: z.string().max(10000).optional().nullable(),
  state: z.string().max(10000).optional().nullable(),
  postal_code: z.string().max(10000).optional().nullable(),
  country: z.string().max(10000).optional().nullable(),
  address_is_enabled: z.boolean().default(false),
  square_feet: z.coerce.number().optional().nullable(),
  year_built: z.coerce.number().optional().nullable(),
  floor_count: z.coerce.number().optional().nullable(),
  has_garage: z.boolean().default(false),
  has_basement: z.boolean().default(false),
  has_attic: z.boolean().default(false),
  has_crawl_space: z.boolean().default(false),
  has_yard: z.boolean().default(false),
  has_shed: z.boolean().default(false)
});

export const createFloorSchema = z.object({
  property_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Floor name is required'),
  floor_number: z.coerce.number(),
  sort_order: z.coerce.number().default(0)
});

export const createRoomSchema = z.object({
  property_id: z.string().uuid().optional(),
  floor_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Room name is required'),
  room_type: z.enum(ROOM_TYPES),
  sort_order: z.coerce.number().default(0),
  notes: z.string().max(10000).optional().nullable(),
  outlet_count: z.coerce.number().optional().nullable(),
  switch_count: z.coerce.number().optional().nullable(),
  vent_count: z.coerce.number().optional().nullable(),
  vent_type: z.string().max(10000).optional().nullable(),
  breaker_label: z.string().max(10000).optional().nullable(),
  has_plumbing: z.boolean().default(false)
});

export const createUtilitySchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  utility_type: z.enum(UTILITY_TYPES),
  name: z.string().min(1, 'Utility name is required'),
  location_notes: z.string().max(10000).optional().nullable(),
  emergency_notes: z.string().max(10000).optional().nullable()
});

export const createAssetSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_type: z.enum(ASSET_TYPES),
  name: z.string().min(1, 'Asset name is required'),
  brand: z.string().max(10000).optional().nullable(),
  model: z.string().max(10000).optional().nullable(),
  serial_number: z.string().max(10000).optional().nullable(),
  purchase_date: z.string().max(10000).optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  retailer: z.string().max(10000).optional().nullable(),
  warranty_length_months: z.coerce.number().optional().nullable(),
  warranty_expires_at: z.string().max(10000).optional().nullable(),
  manual_url: optionalHttpUrlSchema,
  support_url: optionalHttpUrlSchema,
  notes: z.string().max(10000).optional().nullable(),
  visibility: z.enum(VISIBILITY_OPTIONS).default('private'),
  visibility_contexts: z.array(z.enum(VISIBILITY_CONTEXTS)).default(['personal_archive'])
});

export const createReminderSchema = z.object({
  title: z.string().min(1, 'Reminder title is required'),
  description: z.string().max(10000).optional().nullable(),
  reminder_type: z.enum(REMINDER_TYPES),
  due_date: z.string().max(10000).optional().nullable(),
  linked_type: z.enum(REMINDER_LINKED_TYPES).optional().nullable(),
  linked_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  frequency: z.enum(REMINDER_FREQUENCIES).default('none'),
  repeat_rule: z.string().max(10000).optional().nullable(),
  status: z.enum(REMINDER_STATUSES).default('open'),
  priority: z.enum(REMINDER_PRIORITIES).default('normal'),
  source: z.enum(REMINDER_SOURCES).default('manual')
});

export const createRepairSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Repair title is required'),
  description: z.string().max(10000).optional().nullable(),
  repair_type: z.enum(REPAIR_TYPES).default('general'),
  status: z.enum(REPAIR_STATUSES).default('open'),
  priority: z.enum(REPAIR_PRIORITIES).default('normal'),
  reported_date: z.string().max(10000).optional().nullable(),
  completed_date: z.string().max(10000).optional().nullable(),
  contractor_name: z.string().max(10000).optional().nullable(),
  contractor_phone: z.string().max(10000).optional().nullable(),
  contractor_email: z.string().email().optional().nullable(),
  estimated_cost: z.coerce.number().optional().nullable(),
  actual_cost: z.coerce.number().optional().nullable(),
  notes: z.string().max(10000).optional().nullable()
});

export const createServiceRecordSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  service_type: z.enum(SERVICE_TYPES),
  service_title: z.string().min(1, 'Service title is required'),
  service_date: z.string().max(10000).optional().nullable(),
  provider_name: z.string().max(10000).optional().nullable(),
  provider_phone: z.string().max(10000).optional().nullable(),
  provider_email: z.string().email().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  summary: z.string().max(10000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  next_service_date: z.string().max(10000).optional().nullable()
});

export const createIssueSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  repair_id: z.string().uuid().optional().nullable(),
  issue_type: z.enum(ISSUE_TYPES).default('general'),
  title: z.string().min(1, 'Issue title is required'),
  description: z.string().max(10000).optional().nullable(),
  status: z.enum(ISSUE_STATUSES).default('open'),
  severity: z.enum(ISSUE_SEVERITIES).default('medium'),
  first_seen_date: z.string().max(10000).optional().nullable(),
  last_seen_date: z.string().max(10000).optional().nullable(),
  resolved_date: z.string().max(10000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable()
});

export const createTrendFlagSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  issue_id: z.string().uuid().optional().nullable(),
  flag_type: z.enum(TREND_FLAG_TYPES),
  title: z.string().min(1, 'Trend flag title is required'),
  description: z.string().max(10000).optional().nullable(),
  severity: z.enum(ISSUE_SEVERITIES).default('medium'),
  status: z.enum(TREND_FLAG_STATUSES).default('active'),
  detected_from: z.enum(TREND_FLAG_DETECTED_FROM).default('manual'),
  first_detected_at: z.string().max(10000).optional().nullable(),
  last_detected_at: z.string().max(10000).optional().nullable(),
  resolved_at: z.string().max(10000).optional().nullable()
});

export const createDocumentSchema = z.object({
  property_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  reminder_id: z.string().uuid().optional().nullable(),
  repair_id: z.string().uuid().optional().nullable(),
  service_record_id: z.string().uuid().optional().nullable(),
  issue_id: z.string().uuid().optional().nullable(),
  trend_flag_id: z.string().uuid().optional().nullable(),
  document_type: z.enum(DOCUMENT_TYPES).default('other'),
  title: z.string().min(1, 'Document title is required'),
  description: z.string().max(10000).optional().nullable(),
  file_name: z.string().min(1),
  file_path: z.string().min(1),
  bucket_name: z.literal('home-documents').default('home-documents'),
  mime_type: z.string().max(10000).optional().nullable(),
  file_size_bytes: z.coerce.number().nonnegative().optional().nullable(),
  visibility: z.enum(DOCUMENT_VISIBILITIES).default('private'),
  visibility_contexts: z.array(z.enum(VISIBILITY_CONTEXTS)).default(['personal_archive']),
  source: z.enum(DOCUMENT_SOURCES).default('manual_upload')
});

export const createReceiptSchema = z.object({
  property_id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  utility_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  repair_id: z.string().uuid().optional().nullable(),
  service_record_id: z.string().uuid().optional().nullable(),
  vendor_name: z.string().max(10000).optional().nullable(),
  purchase_date: z.string().max(10000).optional().nullable(),
  total_amount: z.coerce.number().optional().nullable(),
  tax_amount: z.coerce.number().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  payment_method: z.string().max(10000).optional().nullable(),
  category: z.enum(RECEIPT_CATEGORIES).default('other'),
  description: z.string().max(10000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  approval_status: z.enum(RECEIPT_APPROVAL_STATUSES).default('approved'),
  source: z.enum(RECEIPT_SOURCES).default('manual_review')
});

export type PropertyType = typeof PROPERTY_TYPES[number];
export type RoomType = typeof ROOM_TYPES[number];
export type UtilityType = typeof UTILITY_TYPES[number];
export type AssetType = typeof ASSET_TYPES[number];
export type VisibilityOption = typeof VISIBILITY_OPTIONS[number];
export type VisibilityContext = typeof VISIBILITY_CONTEXTS[number];
export type WarrantyStatus = typeof WARRANTY_STATUSES[number];
export type ReminderType = typeof REMINDER_TYPES[number];
export type ReminderLinkedType = typeof REMINDER_LINKED_TYPES[number];
export type ReminderStatus = typeof REMINDER_STATUSES[number];
export type ReminderFrequency = typeof REMINDER_FREQUENCIES[number];
export type ReminderPriority = typeof REMINDER_PRIORITIES[number];
export type ReminderSource = typeof REMINDER_SOURCES[number];
export type RepairType = typeof REPAIR_TYPES[number];
export type RepairStatus = typeof REPAIR_STATUSES[number];
export type RepairPriority = typeof REPAIR_PRIORITIES[number];
export type ServiceType = typeof SERVICE_TYPES[number];
export type IssueType = typeof ISSUE_TYPES[number];
export type IssueStatus = typeof ISSUE_STATUSES[number];
export type IssueSeverity = typeof ISSUE_SEVERITIES[number];
export type TrendFlagType = typeof TREND_FLAG_TYPES[number];
export type TrendFlagStatus = typeof TREND_FLAG_STATUSES[number];
export type TrendFlagDetectedFrom = typeof TREND_FLAG_DETECTED_FROM[number];
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type DocumentVisibility = typeof DOCUMENT_VISIBILITIES[number];
export type DocumentSource = typeof DOCUMENT_SOURCES[number];
export type ReceiptCategory = typeof RECEIPT_CATEGORIES[number];
export type ReceiptApprovalStatus = typeof RECEIPT_APPROVAL_STATUSES[number];
export type ReceiptSource = typeof RECEIPT_SOURCES[number];
export type MemberRole = typeof MEMBER_ROLES[number];
export type PlanName = typeof PLAN_NAMES[number];

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateUtilityInput = z.infer<typeof createUtilitySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type CreateServiceRecordInput = z.infer<typeof createServiceRecordSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type CreateTrendFlagInput = z.infer<typeof createTrendFlagSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

export type DbRole = MemberRole;
export type DbVisibility = VisibilityOption;

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HouseholdRow {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PropertyRow {
  id: string;
  household_id: string;
  owner_user_id: string;
  nickname: string;
  property_type: PropertyType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RoomRow {
  id: string;
  property_id: string;
  floor_id: string | null;
  name: string;
  room_type: RoomType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UtilityRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_type: UtilityType;
  name: string;
  visibility: VisibilityOption;
  visibility_contexts?: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AssetRow {
  id: string;
  property_id: string;
  room_id: string | null;
  asset_type: AssetType;
  name: string;
  visibility: VisibilityOption;
  visibility_contexts: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ReminderRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  reminder_type: ReminderType;
  due_date: string | null;
  linked_type: ReminderLinkedType | null;
  linked_id: string | null;
  repeat_rule: string | null;
  frequency: ReminderFrequency;
  status: ReminderStatus;
  priority: ReminderPriority;
  source: ReminderSource;
  visibility: VisibilityOption;
  visibility_contexts?: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RepairRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  title: string;
  description: string | null;
  repair_type: RepairType;
  status: RepairStatus;
  priority: RepairPriority;
  reported_date: string | null;
  completed_date: string | null;
  contractor_name: string | null;
  contractor_phone: string | null;
  contractor_email: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  visibility_contexts?: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ServiceRecordRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  service_type: ServiceType;
  service_title: string;
  service_date: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  provider_email: string | null;
  cost: number | null;
  summary: string | null;
  notes: string | null;
  next_service_date: string | null;
  visibility_contexts?: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface IssueRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  repair_id: string | null;
  issue_type: IssueType;
  title: string;
  description: string | null;
  status: IssueStatus;
  severity: IssueSeverity;
  first_seen_date: string | null;
  last_seen_date: string | null;
  resolved_date: string | null;
  notes: string | null;
  visibility_contexts?: VisibilityContext[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TrendFlagRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  issue_id: string | null;
  flag_type: TrendFlagType;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: TrendFlagStatus;
  detected_from: TrendFlagDetectedFrom;
  first_detected_at: string;
  last_detected_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRow {
  id: string;
  property_id: string;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  reminder_id: string | null;
  repair_id: string | null;
  service_record_id: string | null;
  issue_id: string | null;
  trend_flag_id: string | null;
  automation_device_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  thumbnail_path: string | null;
  bucket_name: 'home-documents';
  mime_type: string | null;
  file_size_bytes: number | null;
  visibility: DocumentVisibility;
  visibility_contexts: VisibilityContext[];
  source: DocumentSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ReceiptRow {
  id: string;
  property_id: string;
  document_id: string | null;
  room_id: string | null;
  utility_id: string | null;
  asset_id: string | null;
  repair_id: string | null;
  service_record_id: string | null;
  vendor_name: string | null;
  purchase_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  currency: string;
  payment_method: string | null;
  category: ReceiptCategory;
  description: string | null;
  notes: string | null;
  approval_status: ReceiptApprovalStatus;
  source: ReceiptSource;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// --- Portfolio (landlord / multi-unit) -------------------------------------
// Units are properties with parent_property_id set; see migration 023. These
// mirror the DB check constraints exactly, same as every enum above.

export const TENANCY_STATUSES = ['upcoming', 'active', 'ended'] as const;

export const CONDITION_REPORT_TYPES = [
  'move_in',
  'move_out',
  'move_out_after_repairs',
  'periodic'
] as const;

export const CONDITION_REPORT_STATUSES = ['draft', 'completed'] as const;

export const CONDITION_RATINGS = ['good', 'fair', 'poor', 'damaged'] as const;

export const COMPLIANCE_OBLIGATION_TYPES = [
  'registration',
  'license',
  'inspection',
  'certification',
  'notice',
  'tax',
  'insurance',
  'other'
] as const;

// Product key the Stripe webhook grants for the recurring landlord plan.
export const PORTFOLIO_PRODUCT_KEY = 'portfolio_plan';

export type TenancyStatus = (typeof TENANCY_STATUSES)[number];
export type ConditionReportType = (typeof CONDITION_REPORT_TYPES)[number];
export type ConditionReportStatus = (typeof CONDITION_REPORT_STATUSES)[number];
export type ConditionRating = (typeof CONDITION_RATINGS)[number];
export type ComplianceObligationType = (typeof COMPLIANCE_OBLIGATION_TYPES)[number];

export const createTenancySchema = z.object({
  property_id: z.string().uuid(),
  label: z.string().min(1, 'A label is required').max(200),
  tenant_names: z.string().max(500).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  deposit_amount_cents: z.coerce.number().int().min(0).optional().nullable(),
  deposit_currency: z.string().max(8).default('usd'),
  deposit_returned_on: z.string().optional().nullable(),
  status: z.enum(TENANCY_STATUSES).default('active'),
  notes: z.string().max(10000).optional().nullable()
});

export const createConditionReportSchema = z.object({
  property_id: z.string().uuid(),
  tenancy_id: z.string().uuid().optional().nullable(),
  report_type: z.enum(CONDITION_REPORT_TYPES),
  report_date: z.string().min(1, 'A report date is required'),
  conducted_by: z.string().max(200).optional().nullable(),
  summary: z.string().max(10000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable()
});

export const createConditionReportEntrySchema = z.object({
  report_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_id: z.string().uuid().optional().nullable(),
  area_label: z.string().max(200).optional().nullable(),
  condition_rating: z.enum(CONDITION_RATINGS).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  sort_order: z.coerce.number().int().default(0)
});

export const createComplianceObligationSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(1, 'A title is required').max(300),
  authority: z.string().max(300).optional().nullable(),
  jurisdiction: z.string().max(200).optional().nullable(),
  obligation_type: z.enum(COMPLIANCE_OBLIGATION_TYPES).default('other'),
  frequency_months: z.coerce.number().int().min(1).max(240).optional().nullable(),
  next_due: z.string().optional().nullable(),
  last_completed_on: z.string().optional().nullable(),
  retention_years: z.coerce.number().int().min(0).max(100).optional().nullable(),
  reference_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable()
});

export type CreateTenancyInput = z.infer<typeof createTenancySchema>;
export type CreateConditionReportInput = z.infer<typeof createConditionReportSchema>;
export type CreateConditionReportEntryInput = z.infer<typeof createConditionReportEntrySchema>;
export type CreateComplianceObligationInput = z.infer<typeof createComplianceObligationSchema>;

export * from './automation';
export * from './lifespans';
